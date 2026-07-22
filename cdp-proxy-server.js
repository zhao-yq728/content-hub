// CDP 抓取代理 — 在用户本机运行，接收网页发来的链接，通过 CDP 浏览器抓取内容
// 启动方式: node cdp-proxy-server.js
// 监听端口: 3457

const http = require('http');
const WebSocket = require('ws');

const PORT = 3457;
const CDP_PORT = 9222;

// 尝试连接 CDP
async function getCDPPage() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          // 找一个已打开的普通页面
          const page = tabs.find(t => t.type === 'page' && t.url && t.url.startsWith('http'));
          if (page) resolve(page.webSocketDebuggerUrl);
          else reject(new Error('没有找到可用的浏览器页面，请先打开任意网页'));
        } catch (e) {
          reject(new Error('CDP 连接失败，请确认浏览器已开启调试端口 ' + CDP_PORT));
        }
      });
    }).on('error', () => reject(new Error('无法连接浏览器调试端口 ' + CDP_PORT + '，请确认浏览器已启动并开启 --remote-debugging-port=' + CDP_PORT)));
  });
}

// 通过 CDP 执行 JS
function cdpEvaluate(ws, expression, timeout = 8000) {
  return new Promise((resolve, reject) => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; reject(new Error('CDP 执行超时')); }
    }, timeout);
    
    ws.on('message', (data) => {
      if (done) return;
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) {
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      }
      if (msg.id === 2) {
        done = true;
        clearTimeout(timer);
        resolve(msg.result?.result?.value || null);
      }
    });
    ws.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); reject(e); } });
  });
}

// 抓取小红书笔记
async function scrapeXHS(url) {
  const wsUrl = await getCDPPage();
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let step = 0;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 0, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 0, method: 'Page.enable' }));
      step = 1;
    });

    ws.on('message', async (raw) => {
      const msg = JSON.parse(raw.toString());
      
      if (step === 1) {
        step = 2;
        ws.send(JSON.stringify({ id: 100, method: 'Page.navigate', params: { url } }));
      }
      
      if (msg.id === 100) {
        step = 3;
        // 等待页面加载
        const expr = `
          (function wait(){
            var b = document.body ? document.body.innerText : '';
            var t = document.title;
            if (t && b && b.length > 200 && b.indexOf('暂时无法浏览') === -1) {
              return JSON.stringify({title:t, text:b.slice(0,5000)});
            }
            if (b.indexOf('Activity') > -1 || b.indexOf('笔记') > -1 || (b.match(/\\d+\\s*(赞|评论|收藏)/))) {
              return JSON.stringify({title:t, text:b.slice(0,5000)});
            }
            return 'WAITING';
          })()
        `;
        
        // 轮询直到页面加载完成
        let retries = 0;
        const check = async () => {
          try {
            const result = await cdpEvaluate(ws, expr, 5000);
            if (result && result !== 'WAITING') {
              resolve(JSON.parse(result));
              ws.close();
              return;
            }
          } catch (e) { /* 继续重试 */ }
          retries++;
          if (retries < 6) setTimeout(check, 2000);
          else {
            reject(new Error('页面加载超时，该笔记可能是 App 专属内容或需要有效的 xsec_token'));
            ws.close();
          }
        };
        setTimeout(check, 1000);
      }
    });

    ws.on('error', (e) => reject(e));
    setTimeout(() => reject(new Error('WebSocket 连接超时')), 30000);
  });
}

// HTTP 服务器
const server = http.createServer(async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 健康检查
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

  // 抓取接口
  if (req.url === '/scrape' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        if (!url) throw new Error('缺少 URL 参数');
        const result = await scrapeXHS(url);
        result.platform = /xiaohongshu/.test(url) ? 'xiaohongshu' : 
                         /douyin/.test(url) ? 'douyin' : 'other';
        result.url = url;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, data: result }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // 默认
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ name: 'CDP Scrape Proxy', version: '1.0' }));
});

server.listen(PORT, () => {
  console.log(`CDP 抓取代理已启动: http://localhost:${PORT}`);
  console.log(`  /health — 检查浏览器连接状态`);
  console.log(`  /scrape — POST {url: '...'} 抓取内容`);
});
