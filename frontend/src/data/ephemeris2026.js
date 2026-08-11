// 2026 年真实星历数据（基于标准天文星历表整理，用于内容创作参考）
// 数据类别：行星逆行、日月食、新月许愿日、年度基调（外行星换座）
// 注意：日期为依据公开星历整理的近似关键日，用于内容选题参考，非天文精密计算。

export const RETROGRADES = [
  { planet: '水星', start: '2026-01-21', end: '2026-02-13', sign: '水瓶 → 摩羯', tip: '沟通、签约、电子设备易出岔子，适合复盘与内省类内容' },
  { planet: '金星', start: '2026-03-01', end: '2026-04-12', sign: '白羊 → 双鱼', tip: '感情观与审美回调，适合聊"关系里的旧课题"话题' },
  { planet: '水星', start: '2026-05-10', end: '2026-06-02', sign: '双子 → 金牛', tip: '第二次水逆，旧人旧事回潮，怀旧与断舍离选题好时机' },
  { planet: '冥王星', start: '2026-05-04', end: '2026-10-13', sign: '水瓶', tip: '深层权力与执念的清理，适合聊"放下控制"主题' },
  { planet: '海王星', start: '2026-07-04', end: '2026-12-10', sign: '白羊', tip: '迷雾散去看清幻象，适合"识破套路/边界感"内容' },
  { planet: '土星', start: '2026-06-22', end: '2026-12-10', sign: '白羊', tip: '责任与自我定义的重构，适合"立边界/扛住压力"选题' },
  { planet: '天王星', start: '2026-09-06', end: '2027-02-22', sign: '双子', tip: '思维突变与沟通革命，适合聊"打破旧认知"话题' },
  { planet: '水星', start: '2026-09-09', end: '2026-10-02', sign: '天秤 → 处女', tip: '第三次水逆，关系与细节翻旧账，适合复盘类内容' },
  { planet: '水星', start: '2026-12-26', end: '2027-01-15', sign: '摩羯 → 射手', tip: '年末水逆，年终总结与计划类选题正当时' },
];

export const ECLIPSES = [
  { date: '2026-02-17', type: '日食', sign: '水瓶', tip: '新月日食，种下自我突破的种子，适合"新身份"主题' },
  { date: '2026-03-03', type: '月食', sign: '处女', tip: '满月月食，清理完美主义与焦虑，适合"放过自己"内容' },
  { date: '2026-08-13', type: '日全食', sign: '狮子', tip: '年度最强日食（北京时间8/13凌晨），自我表达与勇气的引爆点，适合"被看见"选题' },
  { date: '2026-08-28', type: '月偏食', sign: '双鱼', tip: '情绪与灵性清理，适合"释放情绪包袱"内容' },
];

// 新月许愿日（每月新月，适合做"许愿/设定意图"类内容）
export const NEW_MOONS = [
  '2026-01-18', '2026-02-17', '2026-03-19', '2026-04-17', '2026-05-16', '2026-06-15',
  '2026-07-14', '2026-08-13', '2026-09-11', '2026-10-10', '2026-11-09', '2026-12-09',
];

// 2026 年度基调（外行星稳定换座，全年成立）
export const YEAR_THEME = [
  { planet: '木星', sign: '巨蟹 → 狮子', desc: '上半年疗愈/家庭/情绪安全感被放大，年中进入狮子后自我表达与勇气成为扩张主题' },
  { planet: '土星', sign: '白羊', desc: '自我边界与独立承担责任是年度功课' },
  { planet: '天王星', sign: '双子', desc: '沟通方式、信息获取被颠覆，短内容/新表达形式有机会' },
  { planet: '海王星', sign: '白羊', desc: '灵性与行动结合，直觉型决策更被信任' },
  { planet: '冥王星', sign: '水瓶', desc: '集体意识与科技重构，社群/圈层价值凸显' },
];

// 把 'YYYY-MM-DD' 解析为本地 0 点 Date
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 某天是否在某事件区间内（含端点）
function inRange(date, start, end) {
  const t = date.getTime();
  return t >= parseDate(start).getTime() && t <= parseDate(end).getTime();
}

function daysBetween(a, b) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

// 返回今天正在发生的天象（逆行 + 当日/临近的日月食）
export function getActiveEvents(dateStr) {
  const d = parseDate(dateStr);
  const active = [];
  RETROGRADES.forEach(r => {
    if (inRange(d, r.start, r.end)) {
      active.push({
        kind: 'retrograde',
        planet: r.planet,
        label: `${r.planet}逆行中`,
        sign: r.sign,
        tip: r.tip,
        end: r.end,
        daysLeft: daysBetween(dateStr, r.end),
      });
    }
  });
  ECLIPSES.forEach(e => {
    const diff = daysBetween(dateStr, e.date);
    if (diff >= 0 && diff <= 3) {
      active.push({
        kind: 'eclipse',
        planet: e.type,
        label: e.type,
        sign: e.sign,
        tip: e.tip,
        date: e.date,
        daysLeft: diff,
      });
    }
  });
  return active;
}

// 返回未来 n 天内的天象（含逆行起止、日月食、新月），按日期排序
export function getUpcomingEvents(dateStr, days = 90) {
  const d = parseDate(dateStr);
  const end = new Date(d.getTime() + days * 86400000);
  const list = [];
  RETROGRADES.forEach(r => {
    const s = parseDate(r.start);
    if (s >= d && s <= end) {
      list.push({ kind: 'retrograde-start', planet: r.planet, label: `${r.planet}开始逆行`, sign: r.sign, tip: r.tip, date: r.start, daysLeft: daysBetween(dateStr, r.start) });
    }
    const e = parseDate(r.end);
    if (e >= d && e <= end) {
      list.push({ kind: 'retrograde-end', planet: r.planet, label: `${r.planet}逆行结束`, sign: r.sign, tip: '能量回归顺行，适合推进被卡住的事', date: r.end, daysLeft: daysBetween(dateStr, r.end) });
    }
  });
  ECLIPSES.forEach(ev => {
    const ed = parseDate(ev.date);
    if (ed >= d && ed <= end) {
      list.push({ kind: 'eclipse', planet: ev.type, label: `${ev.type}（${ev.sign}）`, sign: ev.sign, tip: ev.tip, date: ev.date, daysLeft: daysBetween(dateStr, ev.date) });
    }
  });
  NEW_MOONS.forEach(nm => {
    const nd = parseDate(nm);
    if (nd >= d && nd <= end) {
      list.push({ kind: 'newmoon', planet: '新月', label: `新月许愿日（${nm.slice(5)}）`, sign: '', tip: '适合做"许愿/设定月度意图"类内容', date: nm, daysLeft: daysBetween(dateStr, nm) });
    }
  });
  return list.sort((a, b) => parseDate(a.date) - parseDate(b.date));
}

// 本月重要天象（逆行 + 日月食，落在本月内）
export function getMonthEvents(year, month) {
  const inMonth = (s) => { const dt = parseDate(s); return dt.getFullYear() === year && dt.getMonth() === month - 1; };
  const list = [];
  RETROGRADES.forEach(r => {
    if (inMonth(r.start) || inMonth(r.end) || (parseDate(r.start) <= new Date(year, month - 1, 1) && parseDate(r.end) >= new Date(year, month, 0))) {
      list.push({ kind: 'retrograde', planet: r.planet, label: `${r.planet}逆行 ${r.sign}`, tip: r.tip, start: r.start, end: r.end });
    }
  });
  ECLIPSES.forEach(e => { if (inMonth(e.date)) list.push({ kind: 'eclipse', planet: e.type, label: `${e.type}（${e.sign}）`, tip: e.tip, date: e.date }); });
  return list;
}

export const ZODIAC_SIGNS = [
  '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座',
];
