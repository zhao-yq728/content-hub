// 端到端 AI 连通性探针：读取云端 config，做真实 AI 调用测试（不打印 Key）
const URL = 'https://zffvmptqjlfjadrrpxdb.supabase.co';
const KEY = 'sb_publishable_KdpBphg8y9RfoKxqbLwo2Q_OiFdErFG';
const H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function getConfig() {
  const r = await fetch(`${URL}/rest/v1/config?key=eq.settings&select=key,value`, { headers: H });
  if (!r.ok) return { ok: false, err: 'supabase select HTTP ' + r.status };
  const rows = await r.json();
  if (!rows || rows.length === 0) return { ok: true, configured: false };
  const v = rows[0].value || {};
  return { ok: true, configured: !!(v.apiKey && v.apiKey.trim()), provider: v.apiType, apiUrl: v.apiUrl, model: v.model, _row: rows[0] };
}

(async () => {
  const c = await getConfig();
  if (!c.ok) { console.log('CONFIG_ERR ' + JSON.stringify(c)); return; }
  if (!c.configured) { console.log('RESULT NO_KEY  说明：云端未配置 API Key，玄学技能库点「生成」会提示去设置页配置'); return; }
  console.log(`RESULT KEY_CONFIGURED  provider=${c.provider || '-'}  model=${c.model || '-'}`);

  const v = c._row.value;
  const apiUrl = v.apiUrl || 'https://api.deepseek.com/chat/completions';
  const model = v.model || 'deepseek-chat';
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + v.apiKey },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '回复OK' }], max_tokens: 5 }),
    });
    const txt = await r.text();
    console.log(`RESULT AI_TEST  status=${r.status}  ok=${r.ok}  body=${txt.slice(0, 160)}`);
  } catch (e) {
    console.log('RESULT AI_TEST  ok=false  error=' + e.message);
  }
})();
