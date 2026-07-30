import { useState, useEffect, useCallback } from 'react';
import { contentAPI, deconstructAPI, rewriteAPI, hotwordAPI, categoryAPI, configAPI, callAI } from '../api';

const PLATFORM_LABEL = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  zhihu: '知乎',
  other: '其他',
};

const STYLE_LABEL = {
  review: '种草测评',
  tutorial: '干货教程',
  vlog: 'Vlog叙事',
  collection: '合集盘点',
  avoid: '避雷拔草',
  default: '自然真人',
  healing: '治愈系',
  sharp: '犀利系',
  dry: '干货系',
  story: '故事系',
};

const CATEGORY_COLORS = {
  占星: '#8b5cf6', 玄学: '#a855f7', 穿搭: '#ec4899', 生活干货: '#14b8a6',
  自媒体运营: '#f59e0b', 赚钱: '#10b981', 带货: '#ef4444', 变美: '#f472b6',
  养生: '#22c55e', 职场: '#3b82f6', 情感: '#fb7185', 家居生活: '#06b6d4',
  母婴: '#f97316', 美食: '#84cc16', 好物: '#eab308', 旅行: '#0ea5e9',
  学习: '#6366f1', 未分类: '#94a3b8',
};

export default function Home({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContents: 0, deconstructed: 0, rewritten: 0,
    hotwords: 0, pending: 0, apiOk: false,
  });
  const [recentContents, setRecentContents] = useState([]);
  const [recentRewrites, setRecentRewrites] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hotwords, setHotwords] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [contents, decons, rewrites, cats, hots, cfg] = await Promise.all([
        contentAPI.list({ limit: 500 }),
        deconstructAPI.list(),
        rewriteAPI.list(),
        categoryAPI.list(),
        hotwordAPI.list(),
        configAPI.get(),
      ]);
      const total = contents.length;
      const pending = contents.filter(c => !c.has_deconstruction).length;
      setStats({
        totalContents: total,
        deconstructed: decons.length,
        rewritten: rewrites.length,
        hotwords: hots.length,
        pending,
        apiOk: !!(cfg && cfg.apiKey && cfg.apiKey.trim()),
      });
      setRecentContents(contents.slice(0, 6));
      setRecentRewrites(rewrites.slice(0, 5));
      setCategories(cats); // 显示全部分类供选择
      setHotwords(hots.slice(0, 16));
    } catch (e) {
      setToast({ type: 'error', msg: '数据加载失败：' + (e.message || e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function handleScrape() {
    const url = urlInput.trim();
    if (!url) return;
    setScraping(true);
    try {
      const scraped = await contentAPI.scrapeLink(url);
      const created = await contentAPI.create(scraped);
      setToast({ type: 'success', msg: '已抓取并入库：' + (created.title || url).slice(0, 24) });
      setUrlInput('');
      loadAll();
    } catch (e) {
      setToast({ type: 'error', msg: (e.message || e).toString().split('\n')[0] });
    } finally {
      setScraping(false);
    }
  }

  // ---------- 今日创作建议（AI） ----------
  const [suggestions, setSuggestions] = useState([]);
  const [genLoading, setGenLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]); // 手动选中的分类

  /** 切换分类选中状态 */
  function toggleCategory(catName) {
    setSelectedCategories(prev =>
      prev.includes(catName)
        ? prev.filter(n => n !== catName)
        : [...prev, catName]
    );
  }

  async function generateSuggestions() {
    setGenLoading(true);
    setAiError(null);
    try {
      // 按选中的分类筛选素材（未选则用全库最近 8 条）
      const allMaterials = recentContents.map(c => ({
        title: (c.title || '无标题').slice(0, 30),
        category: c.category || '未分类',
      }));
      const materials = selectedCategories.length > 0
        ? allMaterials.filter(m => selectedCategories.includes(m.category)).slice(0, 8)
        : allMaterials.slice(0, 8);
      const words = hotwords.slice(0, 24).map(h => h.word);
      const sys = '你是资深的小红书 / 抖音疗愈玄学赛道内容策划，精通占星、塔罗、能量、身心灵、情绪价值类爆款选题设计。语气亲切、懂平台算法、擅长把抽象概念变成让人想点开的标题。';
      const user = [
        selectedCategories.length > 0
          ? `我今天想专注写【${selectedCategories.join('、')}】这几个方向的内容。`
          : '我没有指定方向，请综合判断。',
        '',
        '我的素材库相关内容（标题 / 分类）：',
        materials.length ? materials.map(m => `- ${m.title}（${m.category}）`).join('\n') : '（暂无匹配素材）',
        '',
        '我热词库里有：',
        words.length ? words.join('、') : '（暂无热词）',
        '',
        '请基于以上，为我生成 4 个【今天就能动笔】的疗愈/玄学爆款选题。要求：',
        '1. 贴合占星/塔罗/能量/身心灵赛道，可结合上面的热词；',
        '2. 角度新颖、不重复、有点击欲望；',
        '3. 每个选题给：标题、切入角度、开头钩子（金句）。',
        '',
        '只返回 JSON 数组，格式严格如下，不要任何额外文字：',
        '[{"title":"选题标题","angle":"切入角度","hook":"开头钩子金句"}]',
      ].join('\n');

      const text = await callAI(user, sys);
      let parsed = null;
      try {
        const m = text.match(/\[[\s\S]*\]/);
        parsed = JSON.parse(m ? m[0] : text);
      } catch (e) { parsed = null; }
      if (Array.isArray(parsed) && parsed.length) {
        setSuggestions(parsed);
      } else {
        setSuggestions([{ title: 'AI 灵感', angle: (text || '').slice(0, 240), hook: '' }]);
      }
    } catch (e) {
      setAiError((e && e.message ? e.message : String(e)).toString().split('\n')[0]);
    } finally {
      setGenLoading(false);
    }
  }

  function copySuggestion(s) {
    const t = `【选题】${s.title || ''}\n角度：${s.angle || ''}\n钩子：${s.hook || ''}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(t).then(
        () => setToast({ type: 'success', msg: '已复制选题，可去仿写工坊粘贴' }),
        () => setToast({ type: 'error', msg: '复制失败，请手动选择' })
      );
    }
  }

  // 流水线进度
  const pipeline = [
    { key: 'collect', label: '采集素材', count: stats.totalContents, color: '#8b5cf6' },
    { key: 'decon', label: 'AI 拆解', count: stats.deconstructed, color: '#3b82f6' },
    { key: 'rewrite', label: '二次仿写', count: stats.rewritten, color: '#10b981' },
  ];
  const maxStage = Math.max(stats.totalContents, 1);

  const today = new Date();
  const dateStr = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';
  const weekday = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 200,
          padding: '12px 18px', borderRadius: 10, fontSize: 13, maxWidth: 320,
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(120deg,#7c3aed 0%,#a855f7 55%,#ec4899 100%)',
        borderRadius: 16, padding: '26px 28px', color: '#fff', marginBottom: 24,
        boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Jennie 的工作台</h2>
            <p style={{ fontSize: 14, opacity: 0.9, margin: '6px 0 0' }}>
              {dateStr} {weekday} · 采集 → 拆解 → 仿写，让每篇内容都有爆款基因
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(255,255,255,0.18)', padding: '8px 14px',
            borderRadius: 20, fontSize: 13, backdropFilter: 'blur(4px)',
          }}>
            <span style={{ fontSize: 14 }}>{stats.apiOk ? '🟢' : '🔴'}</span>
            <span>AI {stats.apiOk ? '已就绪' : '未配置'}</span>
          </div>
        </div>

        {/* Command bar */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleScrape(); }}
            placeholder="粘贴小红书 / 抖音 / 公众号链接，一键抓取入库…"
            style={{
              flex: 1, minWidth: 260, padding: '12px 16px', borderRadius: 10,
              border: 'none', fontSize: 14, outline: 'none', color: '#1f2937',
            }}
          />
          <button
            onClick={handleScrape}
            disabled={scraping || !urlInput.trim()}
            style={{
              padding: '12px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: '#7c3aed', backgroundColor: '#fff',
              opacity: (scraping || !urlInput.trim()) ? 0.6 : 1,
            }}
          >
            {scraping ? '抓取中…' : '⚡ 抓取'}
          </button>
          <button
            onClick={() => onNavigate('library')}
            style={{
              padding: '12px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.5)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#fff',
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          >
            ✍️ 手动录入
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#868e96' }}>工作台加载中…</div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
            <KpiCard label="素材总量" value={stats.totalContents} color="#8b5cf6" icon="📚" />
            <KpiCard label="已拆解" value={stats.deconstructed} color="#3b82f6" icon="🔬" onClick={() => onNavigate('deconstruct')} onNavigate={onNavigate} />
            <KpiCard label="已仿写" value={stats.rewritten} color="#10b981" icon="✍️" onClick={() => onNavigate('rewrite')} onNavigate={onNavigate} />
            <KpiCard label="热词库" value={stats.hotwords} color="#f59e0b" icon="🔥" onClick={() => onNavigate('hotwords')} onNavigate={onNavigate} />
            <KpiCard
              label="待拆解"
              value={stats.pending}
              color={stats.pending > 0 ? '#ef4444' : '#94a3b8'}
              icon="⏳"
              onClick={() => onNavigate('library')}
              onNavigate={onNavigate}
            />
          </div>

          {/* 今日创作建议（AI） */}
          <SectionCard
            title="✨ 今日创作建议"
            subtitle="AI 结合你的素材库 + 热词，生成今天就能动笔的疗愈/玄学选题"
            action={stats.apiOk ? { label: genLoading ? '生成中…' : '🔄 重新生成', onClick: generateSuggestions } : null}
            style={{ marginTop: 18, background: 'linear-gradient(120deg,#faf5ff 0%,#fdf2f8 100%)', border: '1px solid #f3e8ff' }}
          >
            {/* 分类选择器 */}
            <div style={{ marginBottom: selectedCategories.length > 0 ? 14 : 10 }}>
              <div style={{ fontSize: 12, color: '#9333ea', fontWeight: 600, marginBottom: 8 }}>
                📂 选择分类聚焦方向（可多选，不选则用全库）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {categories.map(cat => {
                  const active = selectedCategories.includes(cat.name);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => toggleCategory(cat.name)}
                      style={{
                        padding: '5px 12px', borderRadius: 16, border: 'none',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        backgroundColor: active ? (CATEGORY_COLORS[cat.name] || '#7c3aed') : '#fff',
                        color: active ? '#fff' : '#6b7280',
                        border: active ? 'none' : '1px solid #e5d9f5',
                        transition: 'all 0.15s',
                        boxShadow: active ? `0 2px 8px ${(CATEGORY_COLORS[cat.name] || '#7c3aed')}40` : 'none',
                      }}
                    >
                      {active && '✓ '}{cat.name} ({cat.count})
                    </button>
                  );
                })}
                {selectedCategories.length > 0 && (
                  <button
                    onClick={() => setSelectedCategories([])}
                    style={{
                      padding: '5px 12px', borderRadius: 16, border: '1px solid #fca5a5',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      backgroundColor: '#fff', color: '#dc2626',
                    }}
                  >
                    ✕ 清空
                  </button>
                )}
              </div>
            </div>

            {!stats.apiOk ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#9a3412', fontSize: 13 }}>
                <span>⚠️ 还没配置 AI Key，去设置页填好就能用。</span>
                <button onClick={() => onNavigate('settings')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: '#7c3aed', color: '#fff' }}>去配置</button>
              </div>
            ) : genLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#a855f7', fontSize: 14 }}>✨ AI 正在为你构思今天的选题…</div>
            ) : aiError ? (
                <div style={{ color: '#b91c1c', fontSize: 13 }}>
                <div>⚠️ {aiError}</div>
                <div style={{ color: '#9a3412', marginTop: 6 }}>提示：网页已支持直接调用 AI（手机/电脑均可）。若失败请检查「设置」里 API Key 是否正确，或网络是否可访问智谱服务。</div>
                <button onClick={generateSuggestions} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: '#7c3aed', color: '#fff' }}>重试</button>
              </div>
            ) : suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#a855f7', fontSize: 13 }}>
                还没生成。点右上角「✨ 生成建议」，让 AI 帮你定下今天的选题方向。
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ padding: 14, borderRadius: 12, background: '#fff', border: '1px solid #f0e6ff', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed', lineHeight: 1.4 }}>{i + 1}. {s.title}</div>
                    {s.angle && <div style={{ fontSize: 12, color: '#495057', lineHeight: 1.5 }}><b style={{ color: '#7c3aed' }}>角度</b>：{s.angle}</div>}
                    {s.hook && <div style={{ fontSize: 12, color: '#868e96', fontStyle: 'italic', lineHeight: 1.5 }}>“{s.hook}”</div>}
                    <button onClick={() => copySuggestion(s)} style={{ marginTop: 'auto', alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 8, border: '1px solid #e9d5ff', cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: '#faf5ff', color: '#7c3aed' }}>📋 复制选题</button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Pipeline progress */}
          <SectionCard title="创作流水线" subtitle="看一眼就知道内容卡在哪一步">
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, flexWrap: 'wrap' }}>
              {pipeline.map((stage, i) => {
                const pct = Math.round((stage.count / maxStage) * 100);
                return (
                  <div key={stage.key} style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#495057', fontWeight: 600 }}>{stage.label}</span>
                      <span style={{ fontSize: 13, color: stage.color, fontWeight: 700 }}>{stage.count}</span>
                    </div>
                    <div style={{ height: 10, backgroundColor: '#eef2f7', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: pct + '%', height: '100%', backgroundColor: stage.color,
                        borderRadius: 6, transition: 'width 0.4s',
                      }} />
                    </div>
                    {i < pipeline.length - 1 && (
                      <div style={{ fontSize: 11, color: '#adb5bd', marginTop: 4 }}>
                        ↓ 转化率 {stats.totalContents ? Math.round((pipeline[i + 1].count / Math.max(stage.count, 1)) * 100) : 0}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Two columns: recent contents + sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 18, marginTop: 18 }}>
            {/* Recent contents */}
            <SectionCard
              title="最近素材"
              action={{ label: '查看全部', onClick: () => onNavigate('library') }}
            >
              {recentContents.length === 0 ? (
                <Empty text="还没有素材，粘贴链接或手动录入第一篇吧" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentContents.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 12, border: '1px solid #eef0f3', backgroundColor: '#fff',
                    }}>
                      <div style={{
                        width: 6, height: 38, borderRadius: 3,
                        backgroundColor: CATEGORY_COLORS[c.category] || '#cbd5e1',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: '#212529',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {c.title || '（无标题）'}
                        </div>
                        <div style={{ fontSize: 12, color: '#868e96', marginTop: 3, display: 'flex', gap: 8 }}>
                          <span>{PLATFORM_LABEL[c.platform] || c.platform}</span>
                          <span>·</span>
                          <span style={{ color: CATEGORY_COLORS[c.category] || '#868e96' }}>{c.category || '未分类'}</span>
                          {c.has_deconstruction && <span style={{ color: '#3b82f6' }}>· 已拆解</span>}
                        </div>
                      </div>
                      {c.has_deconstruction ? (
                        <button
                          onClick={() => onNavigate('rewrite')}
                          style={miniBtn('#10b981')}
                        >仿写</button>
                      ) : (
                        <button
                          onClick={() => onNavigate('deconstruct')}
                          style={miniBtn('#7c3aed')}
                        >拆解</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Sidebar: categories + pending todo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SectionCard title="分类分布">
                {categories.length === 0 ? (
                  <Empty text="暂无分类数据" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {categories.map(cat => {
                      const max = Math.max(...categories.map(c => c.count));
                      const pct = Math.round((cat.count / max) * 100);
                      return (
                        <div key={cat.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: '#495057' }}>{cat.name}</span>
                            <span style={{ color: '#868e96' }}>{cat.count}</span>
                          </div>
                          <div style={{ height: 7, backgroundColor: '#eef2f7', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: pct + '%', height: '100%',
                              backgroundColor: CATEGORY_COLORS[cat.name] || '#7c3aed', borderRadius: 4,
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              {stats.pending > 0 && (
                <div style={{
                  padding: 18, borderRadius: 14,
                  background: 'linear-gradient(135deg,#fff7ed,#fef3c7)',
                  border: '1px solid #fed7aa',
                }}>
                  <div style={{ fontSize: 13, color: '#c2410c', fontWeight: 600 }}>⏳ 待办</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#ea580c', margin: '6px 0' }}>{stats.pending}</div>
                  <div style={{ fontSize: 13, color: '#9a3412', marginBottom: 12 }}>篇素材还没拆解，拆完才能仿写</div>
                  <button
                    onClick={() => onNavigate('library')}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                      cursor: 'pointer', fontSize: 14, fontWeight: 600,
                      backgroundColor: '#ea580c', color: '#fff',
                    }}
                  >
                    去拆解
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Recent rewrites */}
          <SectionCard
            title="最近仿写"
            subtitle="AI 基于爆款基因生成的二次创作"
            action={{ label: '去仿写工坊', onClick: () => onNavigate('rewrite') }}
            style={{ marginTop: 18 }}
          >
            {recentRewrites.length === 0 ? (
              <Empty text="还没有仿写内容，先拆解一篇素材试试" />
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
              }}>
                {recentRewrites.map(r => (
                  <div key={r.id} style={{
                    padding: 14, borderRadius: 12, border: '1px solid #eef0f3',
                    backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#212529', lineHeight: 1.4 }}>
                      {r.title || '（无标题）'}
                    </div>
                    <div style={{
                      fontSize: 12, color: '#fff', backgroundColor: '#10b981',
                      padding: '2px 8px', borderRadius: 10, alignSelf: 'flex-start',
                    }}>
                      {STYLE_LABEL[r.style] || '仿写'}
                    </div>
                    <div style={{
                      fontSize: 12, color: '#868e96', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {(r.body || '').slice(0, 80)}…
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Hotwords preview */}
          <SectionCard title="热词速览" action={{ label: '管理热词库', onClick: () => onNavigate('hotwords') }} style={{ marginTop: 18 }}>
            {hotwords.length === 0 ? (
              <Empty text="热词库为空，录入素材后会自动提取" />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {hotwords.map(h => (
                  <span key={h.word} style={{
                    fontSize: 13, padding: '6px 12px', borderRadius: 20,
                    backgroundColor: '#f3f0ff', color: '#7c3aed', border: '1px solid #e9d5ff',
                  }}>
                    {h.word}
                    {typeof h.count === 'number' && <span style={{ color: '#a78bfa', marginLeft: 4 }}>·{h.count}</span>}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, icon, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 18, borderRadius: 14, backgroundColor: '#fff', border: '1px solid #eef0f3',
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#868e96' }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, action, children, style }) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: 14, border: '1px solid #eef0f3',
      padding: 20, ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#212529', margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 12, color: '#adb5bd', margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              fontSize: 13, color: '#7c3aed', background: 'none', border: 'none',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: '#adb5bd', fontSize: 13 }}>
      {text}
    </div>
  );
}

function miniBtn(color) {
  return {
    padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: color,
    whiteSpace: 'nowrap',
  };
}
