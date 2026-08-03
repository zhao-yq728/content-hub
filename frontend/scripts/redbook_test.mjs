// 真实测试「玄学小红书笔记」卡片：复刻 Skills.jsx 的 buildPrompt + callAI 路径
const URL = 'https://zffvmptqjlfjadrrpxdb.supabase.co';
const KEY = 'sb_publishable_KdpBphg8y9RfoKxqbLwo2Q_OiFdErFG';
const H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function getConfig() {
  const r = await fetch(`${URL}/rest/v1/config?key=eq.settings&select=key,value`, { headers: H });
  const rows = await r.json();
  return rows[0].value;
}

// 复刻 redbook 卡片的 buildPrompt（tutorial 类型）
function buildPrompt(input, noteType) {
  const map = {
    review: '种草测评型（痛点共鸣 → 方法/产品引入 → 分维度对比 → 推荐结论）',
    tutorial: '干货教程型（问题场景 → 解决方法 → 分步操作 → 效果展示）',
    collection: '合集盘点型（需求定义 → 筛选标准 → 分项推荐 → 总结对比）',
    avoid: '避雷拔草型（期待 vs 现实 → 问题罗列 → 替代方案 → 省钱建议）',
    vlog: 'Vlog 叙事型（开始状态 → 转折事件 → 解决方案 → 结果 + 感受）',
  };
  const type = map[noteType] || map.tutorial;
  const topic = input && input.trim() ? input.trim() : '近期玄学/疗愈热点';
  return `你是一位精通小红书平台的玄学/疗愈内容创作者，风格自然、有真人感。请以"${topic}"为主题，写一篇【${type}】的小红书笔记。\n\n写作要求：\n1. 标题要有爆款感：可用数字型、情绪型、悬念型；\n2. 正文严格按【${type}】的结构展开；\n3. 排版规范：多用换行和 emoji 分段（每段≤5行）、关键信息**加粗**、正文 300-800 字；\n4. 结尾必须引导互动；\n5. 配图建议：封面 + 2-3 张内页方向。\n\n严格按以下格式输出：\n📌 标题：[标题]\n---\n[正文]\n---\n🏷️ 标签\n#标签1 #标签2\n##标签3 ##标签4\n###标签5 ###标签6 ###标签7\n---\n📸 配图建议\n- 封面：[描述]\n- 图2：[描述]\n- 图3：[描述]`;
}

(async () => {
  const cfg = await getConfig();
  const prompt = buildPrompt('水逆期间怎么自保', 'tutorial');
  const sys = '你是内容创作者背后的玄学顾问，输出可直接用于小红书/朋友圈/短视频口播的玄学内容。语气稳、准、有层次，不恐吓、不绝对化。';
  const r = await fetch(cfg.apiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
    body: JSON.stringify({ model: cfg.model || 'glm-4-flash', temperature: 0.8, max_tokens: 2000, messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] }),
  });
  const data = await r.json();
  console.log(data.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 300));
})();
