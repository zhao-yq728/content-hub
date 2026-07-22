// CDP 抓取代理 v2.1 — HTTPS + HTTP 双端口，跨平台
// 启动方式: node cdp-proxy-server.cjs
// HTTP: 3457, HTTPS: 3443

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const HTTP_PORT = 3457;
const HTTPS_PORT = 3443;
const CDP_PORT = 9222;
const CERTS_DIR = path.join(__dirname, '..', 'certs');

// ========== 平台检测 ==========
function detectPlatform(url) {
  const u = url.toLowerCase();
  if (/xiaohongshu\.com|xhslink\.com/.test(u)) return 'xiaohongshu';
  if (/douyin\.com|iesdouyin\.com/.test(u)) return 'douyin';
  if (/mp\.weixin\.qq\.com/.test(u)) return 'wechat';
  if (/weibo\.com|weibo\.cn/.test(u)) return 'weibo';
  if (/zhihu\.com/.test(u)) return 'zhihu';
  if (/bilibili\.com/.test(u)) return 'bilibili';
  return 'other';
}

// ========== 平台特定的等待条件 ==========
function getWaitExpression(platform) {
  switch (platform) {
    case 'xiaohongshu':
      return `
        (function(){
          var b=document.body?document.body.innerText:'';
          if(b.indexOf('暂时无法浏览')>-1) return 'ERROR:APP_ONLY';
          if(b.indexOf('你访问的页面不见了')>-1) return 'ERROR:NOT_FOUND';
          var hasNote=/\\d+\\s*(赞|评论|收藏)/.test(b)||b.indexOf('已关注')>-1||b.indexOf('#')>-1&&b.indexOf('编辑于')>-1;
          return hasNote?'READY':b.length>300?'READY':'WAITING';
        })()
      `;
    case 'douyin':
      return `
        (function(){
          var b=document.body?document.body.innerText:'';
          if(b.indexOf('验证')>-1||b.indexOf('滑块')>-1) return 'ERROR:VERIFY';
          var t=document.title||'';
          return t&&t!=='抖音'&&b.length>200?'READY':'WAITING';
        })()
      `;
    case 'wechat':
      return `
        (function(){
          var b=document.body?document.body.innerText:'';
          var t=document.title||'';
          if(b.indexOf('验证')>-1) return 'ERROR:VERIFY';
          return t&&t!=='微信公众平台'&&b.length>500?'READY':'WAITING';
        })()
      `;
    default:
      return `
        (function(){
          var b=document.body?document.body.innerText:'';
          return b.length>300?'READY':'WAITING';
        })()
      `;
  }
}

// ========== 平台特定的内容提取 ==========
function getExtractExpression(platform) {
  switch (platform) {
    case 'xiaohongshu':
      return `
        (function(){
          var t=document.title||'';
          var b=document.body?document.body.innerText:'';
          var noteStart=b.indexOf('已关注');
          if(noteStart<0) noteStart=b.indexOf('关注');
          var footer=b.indexOf('沪ICP备');
          var content=b.slice(Math.max(noteStart,0),footer>0?footer:b.length);
          var tags=[];var m=content.match(/#[\u4e00-\u9fa5a-zA-Z0-9]+/g);
          if(m) tags=m.slice(0,15);
          return JSON.stringify({title:t,text:content,tags:tags||[]});
        })()
      `;
    case 'douyin':
      return `
        (function(){
          var t=document.title||'';
          var b=document.body?document.body.innerText:'';
          // 尝试提取结构化字段
          var author=''; var am=document.querySelector('[class*=author]')||document.querySelector('[class*=nickname]');
          if(am) author=am.innerText.trim();
          // 提取文字描述区
          var desc=''; var dm=document.querySelector('[class*=desc]')||document.querySelector('[class*=content]');
          if(dm) desc=dm.innerText.slice(0,2000);
          if(!desc) desc=b.slice(0,2000);
          // 提取标签
          var tags=[]; var tm=b.match(/#[\\u4e00-\\u9fa5a-zA-Z0-9_]+/g);
          if(tm) tags=tm.slice(0,20);
          // 计算字数
          var charCount=(desc||'').replace(/[\\s\\n]/g,'').length;
          var estimatedSec=Math.round(charCount/4);
          return JSON.stringify({title:t,text:desc||b.slice(0,5000),author:author,tags:tags||[],charCount:charCount,estimatedSec:estimatedSec});
        })()
        })()
      `;
    case 'wechat':
      return `
        (function(){
          var t=document.title||'';
          var el=document.querySelector('#js_content')||document.querySelector('.rich_media_content');
          var text=el?el.innerText.slice(0,5000):(document.body?document.body.innerText.slice(0,5000):'');
          var author='';var am=document.querySelector('#js_name')||document.querySelector('.rich_media_meta_nickname');
          if(am) author=am.innerText.trim();
          var date='';var dm=document.querySelector('#publish_time')||document.querySelector('.rich_media_meta_text');
          if(dm) date=dm.innerText.trim();
          return JSON.stringify({title:t,text:text,author:author,date:date});
        })()
      `;
    default:
      return `
        (function(){
          var t=document.title||'';
          var b=document.body?document.body.innerText.slice(0,5000):'';
          var desc=document.querySelector('meta[name=\"description\"]');
          return JSON.stringify({title:t,text:b,desc:desc?desc.content:''});
        })()
      `;
  }
}

// ========== CDP 操作 ==========
function getCDPPage() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:' + CDP_PORT + '/json', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          const page = tabs.find(t => t.type === 'page' && t.url && t.url.startsWith('http'));
          if (page) resolve(page.webSocketDebuggerUrl);
          else reject(new Error('没有可用浏览器页面'));
        } catch (e) {
          reject(new Error('CDP 连接失败'));
        }
      });
    }).on('error', () => reject(new Error('浏览器调试端口 ' + CDP_PORT + ' 未启动')));
  });
}

function cdpCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    ws.send(JSON.stringify({ id, method, params }));
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.removeListener('message', handler);
          resolve(msg.result || msg);
        }
      } catch (e) { reject(e); }
    };
    ws.on('message', handler);
    ws.on('error', (e) => { ws.removeListener('message', handler); reject(e); });
    setTimeout(() => { ws.removeListener('message', handler); reject(new Error('超时')); }, 15000);
  });
}

// ========== 主抓取流程 ==========
async function scrape(url) {
  const platform = detectPlatform(url);
  const wsUrl = await getCDPPage();

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let done = false;

    ws.on('open', async () => {
      try {
        await cdpCommand(ws, 'Runtime.enable');
        await cdpCommand(ws, 'Page.enable');
        await cdpCommand(ws, 'Page.navigate', { url });

        // 轮询等待页面加载
        const waitExpr = getWaitExpression(platform);
        let ready = false;
        for (let i = 0; i < 12; i++) {
          await sleep(2000);
          const result = await cdpCommand(ws, 'Runtime.evaluate', {
            expression: waitExpr,
            returnByValue: true,
          });
          const val = result?.result?.value;
          if (val === 'READY') { ready = true; break; }
          if (val && val.startsWith('ERROR:')) {
            const err = val.replace('ERROR:', '');
            if (err === 'APP_ONLY') throw new Error('该笔记为 App 专属内容，请使用带 xsec_token 的分享链接');
            if (err === 'NOT_FOUND') throw new Error('页面不存在或链接已失效');
            if (err === 'VERIFY') throw new Error('触发验证码，请在浏览器中手动验证后重试');
            throw new Error('页面加载异常: ' + err);
          }
        }
        if (!ready) throw new Error('页面加载超时，请确认链接有效且已登录对应平台');

        // 提取内容
        await sleep(1000);
        const extractExpr = getExtractExpression(platform);
        const res = await cdpCommand(ws, 'Runtime.evaluate', {
          expression: extractExpr,
          returnByValue: true,
        });

        done = true;
        const raw = res?.result?.value;
        if (!raw) throw new Error('内容提取失败');
        const parsed = JSON.parse(raw);
        resolve({
          title: (parsed.title || '').replace(/[-—–]\s*(小红书|抖音|微信).*$/, '').trim(),
          text: parsed.text || parsed.desc || '',
          tags: parsed.tags || [],
          author: parsed.author || '',
          date: parsed.date || '',
          platform,
          url,
        });
      } catch (e) {
        if (!done) reject(e);
      }
      try { ws.close(); } catch (e) { /* ignore */ }
    });

    ws.on('error', (e) => { if (!done) reject(e); });
    setTimeout(() => { if (!done) { done = true; reject(new Error('连接超时')); } }, 45000);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== HTTP 服务器 ==========
const handleRequest = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.url === '/health') {
    try {
      await getCDPPage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', cdp: true }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', cdp: false, message: e.message }));
    }
    return;
  }

  if (req.url === '/scrape' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        if (!url) throw new Error('缺少 URL 参数');
        const result = await scrape(url);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, data: result }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (req.url === '/ai' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { prompt, systemPrompt, apiKey, apiUrl, model } = JSON.parse(body);
        if (!apiKey) throw new Error('缺少 API Key');
        const url = apiUrl || 'https://api.deepseek.com/chat/completions';
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
          },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt || 'You are a helpful assistant' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 2000,
          }),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          let msg = txt;
          try { msg = JSON.parse(txt).error?.message || msg; } catch (e) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'API ' + resp.status + ': ' + msg }));
          return;
        }
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'AI 返回内容为空' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, content }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '代理失败: ' + e.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ name: 'CDP Scrape Proxy v2.1' }));
}

const httpServer = http.createServer(handleRequest);
httpServer.listen(HTTP_PORT, () => console.log('HTTP  http://localhost:' + HTTP_PORT));

try {
  const cert = fs.readFileSync(path.join(CERTS_DIR, 'cert.pem'));
  const key = fs.readFileSync(path.join(CERTS_DIR, 'key.pem'));
  https.createServer({ cert, key }, handleRequest).listen(HTTPS_PORT, () => console.log('HTTPS https://localhost:' + HTTPS_PORT));
} catch (e) { console.log('HTTPS: cert not found'); }
console.log('支持: 小红书/抖音/公众号/微博/知乎/B站 | /ai 代理');
