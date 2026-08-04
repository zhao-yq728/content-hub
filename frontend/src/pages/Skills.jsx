import { useState, useMemo } from 'react';
import { callAI, savedAPI } from '../api';
import { getActiveEvents, getUpcomingEvents, RETROGRADES } from '../data/ephemeris2026';

// 22 张大阿尔克那（塔罗），用于「每日一牌」抽牌
const MAJOR_ARCANA = [
  { n: 0, name: '愚人', key: '新的开始、纯真、冒险' },
  { n: 1, name: '魔术师', key: '显化、创造力、行动力' },
  { n: 2, name: '女祭司', key: '直觉、潜意识、内在智慧' },
  { n: 3, name: '皇后', key: '丰盛、滋养、 feminine 能量' },
  { n: 4, name: '皇帝', key: '秩序、掌控、稳定结构' },
  { n: 5, name: '教皇', key: '传统、信念、寻求指引' },
  { n: 6, name: '恋人', key: '关系、选择、爱与结合' },
  { n: 7, name: '战车', key: '意志、前进、克服阻碍' },
  { n: 8, name: '力量', key: '温柔的勇气、自我驾驭' },
  { n: 9, name: '隐士', key: '内省、独处、寻找真理' },
  { n: 10, name: '命运之轮', key: '转折、周期、顺势而为' },
  { n: 11, name: '正义', key: '平衡、因果、公平决断' },
  { n: 12, name: '倒吊人', key: '换位、暂停、换个角度看' },
  { n: 13, name: '死神', key: '结束与重生、放下旧我' },
  { n: 14, name: '节制', key: '调和、耐心、中庸之道' },
  { n: 15, name: '恶魔', key: '执念、束缚、看清诱惑' },
  { n: 16, name: '高塔', key: '突变、崩塌、破除假象' },
  { n: 17, name: '星星', key: '希望、疗愈、方向感' },
  { n: 18, name: '月亮', key: '迷雾、潜意识、情绪起伏' },
  { n: 19, name: '太阳', key: '喜悦、明朗、生命力' },
  { n: 20, name: '审判', key: '觉醒、召唤、重新出发' },
  { n: 21, name: '世界', key: '圆满、整合、阶段达成' },
];

const SIGNS = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];

const panel = {
  background: '#fff',
  borderRadius: 14,
  padding: 20,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  border: '1px solid #f1f3f5',
};

export default function Skills({ onNavigate }) {
  const today = new Date().toISOString().slice(0, 10);
  const activeEvents = useMemo(() => getActiveEvents(today), [today]);
  const upcoming = useMemo(() => getUpcomingEvents(today, 60), [today]);

  const [results, setResults] = useState({});   // skillId -> 文本
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState({});      // skillId -> 文本输入
  const [noteTypes, setNoteTypes] = useState({}); // skillId -> 笔记类型
  const [savedSet, setSavedSet] = useState({});   // skillId -> true（已收藏标记）

  async function runSkill(id, buildPrompt, input, noteType) {
    setLoading(l => ({ ...l, [id]: true }));
    setError(null);
    try {
      const prompt = buildPrompt(input, noteType);
      const sys = '你是内容创作者背后的玄学顾问，输出可直接用于小红书/朋友圈/短视频口播的玄学内容。语气稳、准、有层次，不恐吓、不绝对化。';
      const text = await callAI(prompt, sys);
      setResults(r => ({ ...r, [id]: text }));
    } catch (e) {
      setError((e.message || '生成失败') + '\n（提示：AI 需设置页配置可用 API Key；网页已支持直接调用 AI）');
    }
    setLoading(l => ({ ...l, [id]: false }));
  }

  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  }

  async function saveResult(skillId, skillTitle, text) {
    await savedAPI.create({ type: 'skill', title: skillTitle, body: text });
    setSavedSet(s => ({ ...s, [skillId]: true }));
  }

  // ====== 各技能 prompt 构造（结合真实星历 + 命理技能框架） ======
  const SKILLS = [
    {
      id: 'horoscope',
      icon: '🔮',
      title: '十二星座日运',
      desc: '结合今日真实天象，生成 12 星座今日运势，可直接发笔记/朋友圈',
      buildPrompt: () => {
        const ev = activeEvents.map(e => `${e.label}（${e.sign || ''}，余 ${e.daysLeft} 天）`).join('；') || '今日无明显重大天象';
        return `今天是 ${today}。真实天象背景：${ev}。\n请作为专业占星师，为十二星座各写今日运势。\n输出结构：先给一句今日总运，再给一个具体可执行的小建议。\n用 JSON 返回：{"items":[{"sign":"白羊座","fortune":"总运一句","advice":"小建议一句"}, ...共12个]}\n星座顺序：${SIGNS.join('、')}`;
      },
    },
    {
      id: 'monthly',
      icon: '🌙',
      title: '本月天象播报',
      desc: '把未来 60 天的逆行/日月食/新月整理成「月运 + 内容角度」',
      buildPrompt: () => {
        const list = upcoming.length ? upcoming.map(e => `· ${e.date} ${e.label}${e.sign ? '（' + e.sign + '）' : ''}：${e.tip}`).join('\n') : '未来 60 天无重大天象节点';
        return `基于真实星历，未来 60 天的重要天象：\n${list}\n\n请写一段「本月天象播报」内容，用于玄学/疗愈类账号。要求：\n1. 先用 2-3 句总断本月能量基调；\n2. 挑 2-3 个最值得讲的天象，分别给「天象是什么 + 对普通人的影响 + 一个内容选题角度」；\n3. 结尾给一句点醒的话。\n语气：神秘玄学风但不故弄玄虚，像懂行的朋友在聊。`;
      },
    },
    {
      id: 'retro',
      icon: '♻️',
      title: '水逆 / 天象预警',
      desc: '当前正在发生的逆行，生成「预警文案 + 钩子」，适合做提醒类爆款',
      buildPrompt: () => {
        const act = RETROGRADES.filter(r => r.start <= today && r.end >= today)
          .map(r => `${r.planet}逆行（${r.start}~${r.end}，${r.sign}）：${r.tip}`).join('\n') || '当前无行星逆行';
        return `今天 ${today}，正在发生的行星逆行：\n${act}\n\n请生成一篇「天象预警」内容（适合做提醒/种草类笔记）。要求：\n1. 开头用一句抓人的钩子（如"最近是不是总觉得…"）；\n2. 说明正在发生什么天象、为什么这段时间容易出状况；\n3. 给 3 条具体避坑/顺能量建议；\n4. 结尾引导评论互动。\n语气：温和咨询风，照顾情绪，不吓人。`;
      },
    },
    {
      id: 'tarot',
      icon: '🃏',
      title: '塔罗每日一牌',
      desc: '随机抽一张大阿尔克那，AI 结合牌义给出今日主题 + 疗愈解读',
      buildPrompt: () => {
        const card = MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
        return `请为今天的「塔罗每日一牌」做解读。抽到的牌是【${card.name}】（核心意象：${card.key}）。\n请按塔罗疗愈风输出：\n1. 今日主题（一句话）；\n2. 牌义解读（结合当下普遍情绪，200 字内）；\n3. 给内容创作者的 3 个选题角度（如何把这张牌延展成一篇笔记）；\n4. 一句点醒的话。\n不虚构牌面，只围绕这张牌展开。`;
      },
    },
    {
      id: 'bazi',
      icon: '☯️',
      title: '命理 / 八字简析',
      desc: '输入生辰（可选），生成命格底色 + 内容角度；留空则给命理科普选题',
      buildPrompt: (input) => {
        if (input && input.trim()) {
          return `用户生辰：${input.trim()}。请做一版轻量命理解读（资料为 B 级，仅象征性趋势，不冒充高精度）。\n输出：1. 一句总断（命格底色）；2. 底层原因（用十神/五行简单点一下）；3. 分领域（感情/事业/财富）轻量趋势；4. 给内容创作者的 2-3 个选题角度；5. 一句点醒的话。\n强调：命理是参考不是定数。`;
        }
        return `请给玄学/疗愈账号写一组「命理科普」选题灵感（不针对具体人）。\n输出：5 个普通人最想了解的命理话题（如"为什么总在同一个坑里循环""如何看自己适合什么行业"），每个给角度 + 一句钩子。语气：老师傅直断风，干脆利落。`;
      },
      needsInput: true,
      inputLabel: '生辰（YYYY-MM-DD HH:mm 性别，可选）',
    },
    {
      id: 'energy',
      icon: '✨',
      title: '能量日签',
      desc: '生成今日能量签：幸运色 / 数字 / 方位 + 一句能量语，适合做日更卡片',
      buildPrompt: () => {
        return `请生成今天的「能量日签」（用于疗愈/玄学账号日更卡片）。\n输出：\n1. 今日能量基调（一词，如"沉淀""破局""温柔"）；\n2. 幸运色（含一个搭配建议）；\n3. 幸运数字；\n4. 有利方位（如正北/东南）；\n5. 一句能量语（疗愈、有呼吸感，30 字内）；\n6. 今天适合做 / 不适合做的事各 2 条。\n语气：温柔、有呼吸感，允许句子长短不齐。`;
      },
    },
    {
      id: 'redbook',
      icon: '📕',
      title: '玄学小红书笔记',
      desc: '输入主题 + 选笔记类型，一键生成可直接发的小红书爆款笔记（套用爆款公式）',
      needsInput: true,
      inputLabel: '主题 / 关键词（如：水逆期间怎么自保、巨蟹座本月桃花）',
      typeOptions: [
        { v: 'review', t: '种草测评' },
        { v: 'tutorial', t: '干货教程' },
        { v: 'collection', t: '合集盘点' },
        { v: 'avoid', t: '避雷拔草' },
        { v: 'vlog', t: 'Vlog 叙事' },
      ],
      buildPrompt: (input, noteType) => {
        const map = {
          review: '种草测评型（痛点共鸣 → 方法/产品引入 → 分维度对比 → 推荐结论）',
          tutorial: '干货教程型（问题场景 → 解决方法 → 分步操作 → 效果展示）',
          collection: '合集盘点型（需求定义 → 筛选标准 → 分项推荐 → 总结对比）',
          avoid: '避雷拔草型（期待 vs 现实 → 问题罗列 → 替代方案 → 省钱建议）',
          vlog: 'Vlog 叙事型（开始状态 → 转折事件 → 解决方案 → 结果 + 感受）',
        };
        const type = map[noteType] || map.tutorial;
        const topic = input && input.trim() ? input.trim() : '近期玄学/疗愈热点';
        return `你是一位精通小红书平台的玄学/疗愈内容创作者，风格自然、有真人感。请以"${topic}"为主题，写一篇【${type}】的小红书笔记。\n\n写作要求：\n1. 标题要有爆款感：可用数字型（"3个""5招"）、情绪型（"绝了""后悔没早看"）、悬念型（"99%的人不知道"），要让人刷到想点；\n2. 正文严格按【${type}】的结构展开；\n3. 排版规范：多用换行和 emoji 分段（每段≤5行）、关键信息**加粗**、语气自然不端着、正文 300-800 字；\n4. 结尾必须引导互动（评论 / 收藏 / 关注其一即可）；\n5. 配图建议：给出封面方向 + 2-3 张内页方向。\n\n严格按以下格式输出：\n📌 标题：[标题]\n---\n[正文]\n---\n🏷️ 标签\n#标签1 #标签2\n##标签3 ##标签4\n###标签5 ###标签6 ###标签7\n---\n📸 配图建议\n- 封面：[描述]\n- 图2：[描述]\n- 图3：[描述]`;
      },
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#212529' }}>🔮 玄学技能库</h2>
        <div style={{ color: '#868e96', fontSize: 13, marginTop: 6 }}>
          把占星 / 塔罗 / 命理 / 能量 这些「skill」做成一键内容生成器，点一下就能出可直接发的玄学内容。天象数据基于 2026 真实星历，解读框架参考专业命理方法论。
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {SKILLS.map(skill => (
          <div key={skill.id} style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 26 }}>{skill.icon}</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#212529' }}>{skill.title}</div>
            </div>
            <div style={{ fontSize: 13, color: '#868e96', marginBottom: 12, minHeight: 38 }}>{skill.desc}</div>

            {skill.needsInput && (
              <input value={inputs[skill.id] || ''} onChange={e => setInputs(s => ({ ...s, [skill.id]: e.target.value }))}
                placeholder={skill.inputLabel}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
            )}

            {skill.typeOptions && (
              <select value={noteTypes[skill.id] || skill.typeOptions[0].v}
                onChange={e => setNoteTypes(s => ({ ...s, [skill.id]: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#495057' }}>
                {skill.typeOptions.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select>
            )}

            <button onClick={() => runSkill(skill.id, skill.buildPrompt, inputs[skill.id], noteTypes[skill.id] || (skill.typeOptions?.[0]?.v))} disabled={loading[skill.id]}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: loading[skill.id] ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
              {loading[skill.id] ? '⏳ 生成中...' : '✨ 生成内容'}
            </button>

            {results[skill.id] && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#faf5ff', border: '1px solid #ede9fe', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', lineHeight: 1.7 }}>
                {results[skill.id]}
                <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => copy(results[skill.id])} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontSize: 12 }}>📋 复制</button>
                  <button onClick={() => saveResult(skill.id, skill.title, results[skill.id])} disabled={savedSet[skill.id]} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fde68a', background: savedSet[skill.id] ? '#fef9c3' : '#fff', color: savedSet[skill.id] ? '#92660a' : '#b45309', cursor: savedSet[skill.id] ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>{savedSet[skill.id] ? '✅ 已收藏' : '⭐ 收藏'}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {onNavigate && (
        <div style={{ marginTop: 20, fontSize: 13, color: '#868e96' }}>
          想要更多灵感方向？去 <span style={{ color: '#7c3aed', cursor: 'pointer' }} onClick={() => onNavigate('inspire')}>灵感首页 →</span>
        </div>
      )}
    </div>
  );
}
