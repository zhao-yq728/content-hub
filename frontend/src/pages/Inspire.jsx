import { useState, useEffect, useMemo } from 'react';
import { questionAPI, inspireAPI, contentAPI, callAI, savedAPI } from '../api';
import { getActiveEvents, getMonthEvents, getUpcomingEvents, ZODIAC_SIGNS, YEAR_THEME } from '../data/ephemeris2026';

// ---------- 工具 ----------
function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function daysBetween(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00');
  const b = new Date(bStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
function parseJSON(text) {
  if (!text) return null;
  let t = (text || '').replace(/```json/g, '').replace(/```/g, '').trim();
  const s = t.indexOf('{'); const e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch (err) { return null; }
}
const panel = { padding: 16, marginBottom: 16, borderRadius: 12, backgroundColor: '#fff', border: '1px solid #e9ecef' };
const sectionTitle = (t, s) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 17, fontWeight: 700, color: '#212529' }}>{t}</div>
    {s && <div style={{ fontSize: 12, color: '#868e96', marginTop: 2 }}>{s}</div>}
  </div>
);

export default function Inspire({ onNavigate, onRewriteBrief }) {
  const dateStr = useMemo(todayStr, []);
  const [tab, setTab] = useState('today');

  // 星象
  const activeEvents = useMemo(() => getActiveEvents(dateStr), [dateStr]);
  const monthEvents = useMemo(() => getMonthEvents(new Date().getFullYear(), new Date().getMonth() + 1), []);
  const upcoming = useMemo(() => getUpcomingEvents(dateStr, 90), [dateStr]);

  const [astro, setAstro] = useState(null);        // {analysis, angles[]}
  const [horoscope, setHoroscope] = useState(null); // {白羊座: '...'}
  const [astroLoading, setAstroLoading] = useState(false);
  const [horoLoading, setHoroLoading] = useState(false);
  const [aiErr, setAiErr] = useState('');

  // 问题
  const [questions, setQuestions] = useState([]);
  const [qInput, setQInput] = useState('');
  const [qLoading, setQLoading] = useState(false);

  // 选题
  const [topics, setTopics] = useState([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [savedTopics, setSavedTopics] = useState({}); // index -> true

  useEffect(() => {
    questionAPI.list().then(setQuestions).catch(() => setQuestions([]));
    const cache = inspireAPI.getDaily(dateStr) || {};
    if (cache.astro) setAstro(cache.astro);
    if (cache.horoscope) setHoroscope(cache.horoscope);
    if (cache.topics) setTopics(cache.topics);
  }, [dateStr]);

  // ---------- 星象：解读今日天象 ----------
  async function genAnalysis() {
    setAstroLoading(true); setAiErr('');
    const ev = activeEvents.length
      ? activeEvents.map(e => `- ${e.label}${e.sign ? '（' + e.sign + '）' : ''}：还剩约 ${e.daysLeft} 天，${e.tip}`).join('\n')
      : '今日无重大行星逆行/食相，能量相对平稳';
    const theme = YEAR_THEME.map(t => `${t.planet}在${t.sign}：${t.desc}`).join('；');
    const prompt =
      '你是专业占星师兼内容顾问。今天是 ' + dateStr + '。\n' +
      '【正在发生的天象】\n' + ev + '\n\n' +
      '【2026 年度基调】' + theme + '\n\n' +
      '请做两件事：\n' +
      '1) 用通俗、有画面感的语言解读这些天象对普通人情绪/关系/事业的影响（疗愈玄学受众能看懂）。\n' +
      '2) 给出 3 个适合今天写的疗愈/玄学/占星类内容角度（每个角度一句话，点明"为什么现在写这个有共鸣"）。\n\n' +
      '返回 JSON：{"analysis":"解读文字(150字内)","angles":["角度1","角度2","角度3"]}';
    try {
      const res = await callAI(prompt, '你是资深占星内容创作者，输出纯JSON，不要多余文字。');
      const obj = parseJSON(res);
      if (!obj) throw new Error('解析失败');
      setAstro(obj);
      const c = inspireAPI.getDaily(dateStr) || {};
      inspireAPI.setDaily(dateStr, { ...c, astro: obj });
    } catch (e) {
      setAiErr('AI 解读失败：' + e.message + '（检查设置页 API Key，或稍后重试）');
    }
    setAstroLoading(false);
  }

  // ---------- 星象：十二星座今日运势 ----------
  async function genHoroscope() {
    setHoroLoading(true); setAiErr('');
    const ev = activeEvents.map(e => e.label + (e.sign ? '(' + e.sign + ')' : '')).join('、') || '平稳期';
    const prompt =
      '今天是 ' + dateStr + '，当前天象：' + ev + '。\n' +
      '请为十二星座各写一句今日运势提示（40字内，疗愈玄学调性，可结合当前天象，温暖有引导性）。\n' +
      '返回 JSON，键为星座名，值为运势文字：{"白羊座":"...","金牛座":"...", ... 共12个}';
    try {
      const res = await callAI(prompt, '你是占星师，输出纯JSON，键必须是完整星座名（如"白羊座"），不要多余文字。');
      const obj = parseJSON(res);
      if (!obj) throw new Error('解析失败');
      setHoroscope(obj);
      const c = inspireAPI.getDaily(dateStr) || {};
      inspireAPI.setDaily(dateStr, { ...c, horoscope: obj });
    } catch (e) {
      setAiErr('星座运势生成失败：' + e.message);
    }
    setHoroLoading(false);
  }

  // ---------- 热门问题：添加 / 删除 ----------
  async function addQuestion() {
    const t = qInput.trim();
    if (!t) return;
    setQLoading(true);
    await questionAPI.create(t, '私域');
    const list = await questionAPI.list();
    setQuestions(list);
    setQInput('');
    setQLoading(false);
  }
  async function delQuestion(id) {
    await questionAPI.remove(id);
    setQuestions(await questionAPI.list());
  }

  // ---------- 热门选题：基于 top 问题 + 天象 + 素材 ----------
  async function genTopics() {
    setTopicLoading(true); setAiErr('');
    const topQ = questions.slice(0, 5).map(q => q.text);
    const ev = activeEvents.map(e => e.label + (e.sign ? '(' + e.sign + ')' : '')).join('、') || '平稳期';
    let materials = [];
    try {
      const list = await contentAPI.list();
      materials = (list || []).slice(0, 6).map(c => (c.title || '').slice(0, 24));
    } catch (e) {}
    const prompt =
      '你是疗愈/玄学/占星赛道的内容策划。今天日期 ' + dateStr + '，当前天象：' + ev + '。\n' +
      '【用户私域高频问题（按热度）】\n' + (topQ.length ? topQ.map((q, i) => (i + 1) + '. ' + q).join('\n') : '（暂无比问题，基于赛道自发）') + '\n' +
      '【用户已有素材标题参考】\n' + (materials.length ? materials.map(m => '- ' + m).join('\n') : '（暂无）') + '\n\n' +
      '请生成 5 个今天值得写的爆款选题，结合天象时效性与高频问题，覆盖不同切入角度。\n' +
      '返回 JSON：{"topics":[{"title":"标题","angle":"切入角度","hook":"开头钩子金句(一句)"}]}';
    try {
      const res = await callAI(prompt, '你是爆款内容策划，输出纯JSON，不要多余文字。');
      const obj = parseJSON(res);
      if (!obj || !obj.topics) throw new Error('解析失败');
      setTopics(obj.topics);
      const c = inspireAPI.getDaily(dateStr) || {};
      inspireAPI.setDaily(dateStr, { ...c, topics: obj.topics });
    } catch (e) {
      setAiErr('选题生成失败：' + e.message + '（检查设置页 API Key，或稍后重试）');
    }
    setTopicLoading(false);
  }

  // ---------- 单条问题生成选题，并入选题区 ----------
  async function genTopicForQuestion(q) {
    setTopicLoading(true); setAiErr('');
    const ev = activeEvents.map(e => e.label).join('、') || '平稳期';
    const prompt =
      '用户私域高频问题：「' + q.text + '」。今天天象：' + ev + '。\n' +
      '请基于这个问题，生成 2 个疗愈/玄学/占星方向的爆款选题（不同角度）。\n' +
      '返回 JSON：{"topics":[{"title":"标题","angle":"切入角度","hook":"开头钩子金句(一句)"}]}';
    try {
      const res = await callAI(prompt, '你是爆款内容策划，输出纯JSON。');
      const obj = parseJSON(res);
      if (obj && obj.topics) setTopics(prev => [...obj.topics, ...prev]);
    } catch (e) {
      setAiErr('选题生成失败：' + e.message);
    }
    setTopicLoading(false);
  }

  function copyTopic(t) {
    const txt = `标题：${t.title}\n角度：${t.angle}\n钩子：${t.hook || ''}`;
    navigator.clipboard.writeText(txt);
    alert('已复制选题');
  }
  function goRewrite(t) {
    const brief = `选题：${t.title}\n切入角度：${t.angle}\n开头钩子：${t.hook || ''}`;
    if (onRewriteBrief) onRewriteBrief(brief);
  }

  async function saveTopic(t, i) {
    await savedAPI.create({
      type: 'topic',
      title: t.title,
      body: `角度：${t.angle}\n钩子：${t.hook || ''}`,
      meta: { angle: t.angle, hook: t.hook },
    });
    setSavedTopics(s => ({ ...s, [i]: true }));
  }

  // ---------- 渲染 ----------
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', marginBottom: 4 }}>🌟 灵感首页</h2>
      <div style={{ fontSize: 13, color: '#868e96', marginBottom: 18 }}>
        星象播报 · 热门问题 · 热门选题 —— 每天打开就有创作灵感（数据来自真实 2026 星历 + 你的私域沉淀）
      </div>

      {/* ============ 块1：星象播报 ============ */}
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          {sectionTitle('🪐 星象播报', '主动推送日运 / 月运 / 逆行等关键信息 + 解读')}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ k: 'today', l: '今日' }, { k: 'month', l: '本月' }, { k: 'soon', l: '近期' }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === t.k ? '#7c3aed' : '#f1f3f5', color: tab === t.k ? '#fff' : '#495057',
              }}>{t.l}</button>
            ))}
          </div>
        </div>

        {tab === 'today' && (
          <div>
            {/* 活跃天象横幅 */}
            <div style={{ padding: 14, borderRadius: 10, background: activeEvents.length ? 'linear-gradient(135deg,#fef3c7,#fce7f3)' : '#f1f3f5', border: '1px solid ' + (activeEvents.length ? '#fcd34d' : '#e9ecef'), marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>📡 正在发生的天象（{dateStr}）</div>
              {activeEvents.length === 0 ? (
                <div style={{ fontSize: 13, color: '#6b7280' }}>今日无重大行星逆行/食相，能量平稳，适合做沉淀类、复盘类内容。</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {activeEvents.map((e, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #fde68a', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: '#b45309' }}>{e.label}{e.sign ? `（${e.sign}）` : ''}</div>
                      <div style={{ color: '#92400e', marginTop: 2 }}>剩约 {e.daysLeft} 天 · {e.tip}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 解读 + 星座 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div>
                <button onClick={genAnalysis} disabled={astroLoading}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: astroLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                  {astroLoading ? '⏳ AI 解读中...' : astro ? '🔄 重新解读今日天象' : '✨ 解读今日天象 + 选题角度'}
                </button>
                {astro && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: '#faf5ff', border: '1px solid #ede9fe' }}>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{astro.analysis}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>💡 今天可写的 3 个角度</div>
                    {(astro.angles || []).map((a, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#4c1d95', padding: '6px 10px', background: '#fff', borderRadius: 6, marginBottom: 6, border: '1px solid #f3e8ff' }}>{i + 1}. {a}</div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button onClick={genHoroscope} disabled={horoLoading}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: horoLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#0ea5e9,#7c3aed)' }}>
                  {horoLoading ? '⏳ 生成中...' : horoscope ? '🔄 重新生成星座运势' : '🔮 生成十二星座今日运势'}
                </button>
                {horoscope && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
                    {ZODIAC_SIGNS.map(sign => (
                      <div key={sign} style={{ padding: 10, borderRadius: 8, background: '#fff', border: '1px solid #e9ecef' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9', marginBottom: 4 }}>{sign}</div>
                        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{horoscope[sign] || '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'month' && (
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>本月（{new Date().getFullYear()}年{new Date().getMonth() + 1}月）重要天象 · 提前规划内容节奏</div>
            {monthEvents.length === 0 && <div style={{ fontSize: 13, color: '#868e96' }}>本月无重大天象节点。</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthEvents.map((e, i) => {
                const ref = e.date || e.start;
                const left = ref ? daysBetween(dateStr, ref) : null;
                return (
                  <div key={i} style={{ padding: 12, borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412' }}>{e.label}</div>
                      <div style={{ fontSize: 12, color: '#7c2d12', marginTop: 2 }}>{e.tip}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#9a3412', whiteSpace: 'nowrap', marginLeft: 10 }}>
                      {ref ? (left >= 0 ? `还有 ${left} 天` : `已过去 ${-left} 天`) : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'soon' && (
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>未来 90 天天象时间轴 · 逆行 / 食相 / 新月许愿日</div>
            <div style={{ borderLeft: '2px solid #e9ecef', marginLeft: 8 }}>
              {upcoming.map((e, i) => (
                <div key={i} style={{ padding: '8px 0 8px 16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -6, top: 14, width: 10, height: 10, borderRadius: 5, background: e.kind.includes('eclipse') ? '#ec4899' : e.kind.includes('newmoon') ? '#10b981' : '#7c3aed' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#212529' }}>{e.label} <span style={{ fontSize: 11, color: '#868e96', fontWeight: 400 }}>{e.date} · 还有 {e.daysLeft} 天</span></div>
                  {e.tip && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{e.tip}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============ 块2：热门问题排名 ============ */}
      <div style={panel}>
        {sectionTitle('🔥 热门问题排名', '来自你的私域/用户真实提问，按热度排序，直接喂给选题')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input value={qInput} onChange={e => setQInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQuestion()}
            placeholder="添加一条高频问题，如：水逆期间为什么总吵架？"
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 13, outline: 'none' }} />
          <button onClick={addQuestion} disabled={qLoading}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', background: '#7c3aed' }}>
            {qLoading ? '...' : '添加'}
          </button>
        </div>
        {questions.length === 0 ? (
          <div style={{ fontSize: 13, color: '#868e96', padding: '12px 0' }}>还没有问题，添加你私域里被问得最多的问题，AI 会据此排热点、出选题。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #e9ecef' }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: i < 3 ? ['#f59e0b', '#94a3b8', '#b45309'][i] : '#e9ecef', color: i < 3 ? '#fff' : '#868e96', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: '#212529' }}>{q.text}</div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f1f3f5', color: '#868e96' }}>{q.source || '私域'}</span>
                <span style={{ fontSize: 11, color: '#868e96' }}>🔥{q.ask_count || 1}</span>
                <button onClick={() => genTopicForQuestion(q)} disabled={topicLoading} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d8b4fe', background: '#fff', color: '#7c3aed', cursor: 'pointer', fontSize: 11 }}>生成选题</button>
                <button onClick={() => delQuestion(q.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#868e96', marginTop: 8 }}>
          提示：问题存在云端 Supabase（questions 表）；若表未创建会自动存在本机浏览器。要跨设备同步请在 Supabase 执行 supabase_questions.sql。
        </div>
      </div>

      {/* ============ 块3：热门选题推送 ============ */}
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          {sectionTitle('🚀 热门选题推送', 'AI 结合热门问题 + 当下天象 + 你的素材库，一键出可写选题')}
          <button onClick={genTopics} disabled={topicLoading}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: topicLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', whiteSpace: 'nowrap' }}>
            {topicLoading ? '⏳ 生成中...' : topics.length ? '🔄 重新生成' : '🚀 一键生成热门选题'}
          </button>
        </div>
        {aiErr && <div style={{ fontSize: 12, color: '#b91c1c', padding: '8px 12px', background: '#fef2f2', borderRadius: 8, marginBottom: 12 }}>{aiErr}</div>}
        {topics.length === 0 ? (
          <div style={{ fontSize: 13, color: '#868e96', padding: '20px 0', textAlign: 'center' }}>点右上角「一键生成热门选题」，AI 会结合今天的天象和你的问题库，给你 5 个今天就能动笔的选题。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topics.map((t, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #ede9fe' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#212529', marginBottom: 6 }}>{i + 1}. {t.title}</div>
                <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 4 }}>角度：{t.angle}</div>
                {t.hook && <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic', marginBottom: 10 }}>钩子：{t.hook}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => copyTopic(t)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontSize: 12 }}>📋 复制</button>
                  <button onClick={() => goRewrite(t)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✍️ 去仿写</button>
                  <button onClick={() => saveTopic(t, i)} disabled={savedTopics[i]} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #fde68a', background: savedTopics[i] ? '#fef9c3' : '#fff', color: savedTopics[i] ? '#92660a' : '#b45309', cursor: savedTopics[i] ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>{savedTopics[i] ? '✅ 已收藏' : '⭐ 收藏'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aiErr && tab !== 'today' && (
        <div style={{ fontSize: 11, color: '#868e96', marginTop: -8 }}>AI 功能需设置页配置可用的 API Key；本机也可用直连（网页已支持直接调用 AI）。</div>
      )}
    </div>
  );
}
