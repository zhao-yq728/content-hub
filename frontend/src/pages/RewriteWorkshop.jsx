import { useState, useEffect } from 'react';
import { contentAPI, deconstructAPI, rewriteAPI, hotwordAPI } from '../api';

const NOTE_TYPES = {
  review: { label: '种草测评', desc: '亲身体验+真实对比', color: '#ec4899', icon: '📝',
    formula: '痛点共鸣→产品引入→分维度对比→推荐结论',
    example: '烂脸期用了1个月，这个精华到底有没有用？' },
  tutorial: { label: '干货教程', desc: '步骤清晰+可复制', color: '#3b82f6', icon: '📖',
    formula: '问题场景→解决方法→分步操作→效果展示',
    example: '3分钟学会通勤妆，手残党也能画' },
  vlog: { label: 'Vlog叙事', desc: '故事线+情绪起伏', color: '#10b981', icon: '🎬',
    formula: '开始状态→转折事件→解决方案→结果+感受',
    example: '30岁裸辞后的第100天，我怎么样了' },
  collection: { label: '合集盘点', desc: '筛选标准+多维对比', color: '#f59e0b', icon: '📊',
    formula: '需求定义→筛选标准→分项推荐→总结对比',
    example: '学生党必入的10件平价好物合集' },
  avoid: { label: '避雷拔草', desc: '踩坑经历+真相揭露', color: '#ef4444', icon: '⚠️',
    formula: '期待vs现实→问题罗列→替代方案→省钱建议',
    example: '这5个智商税千万别买！用过的人都说后悔' },
};

export default function RewriteWorkshop({ initialContentId, initialBrief }) {
  const [contents, setContents] = useState([]);
  const [hotwords, setHotwords] = useState([]);
  const [selectedContent, setSelectedContent] = useState(initialContentId || null);
  const [freeBrief, setFreeBrief] = useState(initialBrief || '');
  const [selectedHotwords, setSelectedHotwords] = useState([]);
  const [style, setStyle] = useState('review');
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [tab, setTab] = useState('generate');
  const [showHelp, setShowHelp] = useState(!initialContentId && !initialBrief);
  const [sourceDecon, setSourceDecon] = useState(null);

  useEffect(() => {
    contentAPI.list().then(setContents).catch(console.error);
    hotwordAPI.top(30).then(setHotwords).catch(console.error);
    rewriteAPI.list().then(setSavedList).catch(console.error);
  }, []);

  useEffect(() => {
    if (initialContentId) {
      setSelectedContent(initialContentId);
      setShowHelp(false);
      setTab('generate');
      // 加载对应的拆解信息供展示
      deconstructAPI.get(initialContentId).then(d => {
        if (d) setSourceDecon(d);
      }).catch(console.error);
    }
  }, [initialContentId]);

  useEffect(() => {
    if (initialBrief) {
      setFreeBrief(initialBrief);
      setSelectedContent(null);
      setShowHelp(false);
      setTab('generate');
    }
  }, [initialBrief]);

  const deconstructedContents = contents.filter(c => c.has_deconstruction);
  const selectedMeta = contents.find(c => c.id === selectedContent);

  const toggleHotword = (word) => {
    setSelectedHotwords(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]
    );
  };

  const handleGenerate = async () => {
    if (!selectedContent && !freeBrief) return alert('请先选择模板，或在灵感首页用「去仿写」带入选题方向');
    setGenerating(true);
    try {
      const data = await rewriteAPI.run({
        content_id: selectedContent || null,
        brief: selectedContent ? '' : freeBrief,
        hotwords: selectedHotwords,
        style,
        count,
      });
      setResults(data.items || data);
    } catch (e) {
      alert('生成失败: ' + e.message);
    }
    setGenerating(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', marginBottom: 20 }}>AI 仿写工坊</h2>

      {/* 工作流说明 - 顶部醒目标识 */}
      <div style={{
        padding: 14, marginBottom: 20, borderRadius: 10,
        background: 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 100%)',
        border: '1px solid #d8b4fe', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 24 }}>✨</div>
        <div style={{ flex: 1, fontSize: 13, color: '#6b21a8' }}>
          <strong>使用流程：</strong>
          素材库拆解内容 → 拆解报告点「立即仿写」→ 选择风格+热词 → 生成新内容 → 创作库中查看
        </div>
        <button onClick={() => setShowHelp(!showHelp)} style={{
          padding: '4px 10px', fontSize: 12, background: '#fff', color: '#7c3aed',
          border: '1px solid #d8b4fe', borderRadius: 6, cursor: 'pointer',
        }}>
          {showHelp ? '隐藏' : '展开'}教程
        </button>
      </div>

      {showHelp && (
        <div style={{
          padding: 18, marginBottom: 20, borderRadius: 10,
          backgroundColor: '#fff', border: '1px solid #e9ecef',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#212529' }}>📖 完整使用教程</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { step: '1', title: '在素材库拆解内容', desc: '对一条内容点击「🔬 拆解」按钮，AI 会分析出标题公式/开篇钩子/情绪曲线等爆款基因' },
              { step: '2', title: '进入拆解报告', desc: '拆解完成后会自动跳转到拆解中心，可以查看完整的爆款基因分析' },
              { step: '3', title: '点击「立即仿写」', desc: '拆解报告页右上角的紫色按钮，会直接带这个模板来到仿写工坊' },
              { step: '4', title: '选风格+热词', desc: '选择 5 种风格之一，可选点击热词作为必须融入的关键词' },
              { step: '5', title: '生成并保存', desc: '点击「开始生成」，AI 会基于这个模板生成 1-5 条新内容，自动存到创作库' },
            ].map(s => (
              <div key={s.step} style={{ padding: 12, borderRadius: 8, backgroundColor: '#f8f9fa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{s.step}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#212529' }}>{s.title}</div>
                </div>
                <div style={{ fontSize: 12, color: '#495057', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e9ecef' }}>
        {[{ k: 'generate', l: '生成新内容' }, { k: 'saved', l: '创作库' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '10px 20px', border: 'none', background: 'none',
            fontSize: 14, fontWeight: tab === t.k ? 600 : 400,
            color: tab === t.k ? '#7c3aed' : '#868e96',
            borderBottom: tab === t.k ? '2px solid #7c3aed' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -2,
          }}>{t.l}</button>
        ))}
      </div>

      {/* 来自灵感首页的自由选题方向 */}
      {freeBrief && (
        <div style={{ padding: 14, marginBottom: 20, borderRadius: 10, background: 'linear-gradient(135deg,#fef3c7 0%,#fce7f3 100%)', border: '1px solid #fcd34d', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🌟</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>来自灵感首页的选题方向</div>
            <div style={{ fontSize: 13, color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{freeBrief}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={handleGenerate} disabled={generating} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: generating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
                background: 'linear-gradient(135deg,#7c3aed 0%,#ec4899 100%)',
              }}>{generating ? '⏳ 生成中...' : '🚀 用这个方向直接写'}</button>
              <button onClick={() => setFreeBrief('')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d8b4fe', background: '#fff', color: '#7c3aed', cursor: 'pointer', fontSize: 12 }}>清除</button>
              <span style={{ fontSize: 12, color: '#a16207' }}>选好下方笔记类型后点此生成（无需模板）</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'generate' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* 左侧：配置 */}
          <div>
            {/* 模板选择 */}
            <div style={panelStyle}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>1</span>
                选择爆款模板
              </div>
              <select
                value={selectedContent || ''}
                onChange={e => setSelectedContent(e.target.value)}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="">-- 选择已拆解的内容 --</option>
                {deconstructedContents.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title?.substring(0, 50) || '未命名'}
                  </option>
                ))}
              </select>
              {deconstructedContents.length === 0 && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8, padding: 8, background: '#fef2f2', borderRadius: 6 }}>
                  ⚠️ 还没有已拆解的内容，请去素材库对内容点击「🔬 拆解」
                </div>
              )}
              {selectedMeta && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: '#15803d', marginBottom: 4 }}>✓ 已选模板：{selectedMeta.title}</div>
                  {sourceDecon && sourceDecon.title_formula && (
                    <div style={{ color: '#166534', fontSize: 11 }}>
                      标题公式：{sourceDecon.title_formula}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 笔记类型 */}
            <div style={panelStyle}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>2</span>
                选择笔记类型
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(NOTE_TYPES).map(([k, s]) => (
                  <button key={k} onClick={() => setStyle(k)} style={{
                    padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                    border: style === k ? '2px solid ' + s.color : '1px solid #dee2e6',
                    backgroundColor: style === k ? s.color + '10' : '#fff',
                    cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: style === k ? s.color : '#212529' }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: '#868e96' }}>{s.desc}</div>
                      </div>
                    </div>
                    {style === k && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, backgroundColor: '#f8f9fa', fontSize: 12, color: '#495057' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>爆款公式：{s.formula}</div>
                        <div style={{ color: '#868e96', fontStyle: 'italic' }}>示例：{s.example}</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 热词 */}
            <div style={panelStyle}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>3</span>
                选择热词组合（可选）
              </div>
              <div style={{ fontSize: 12, color: '#868e96', marginBottom: 10 }}>
                已选 {selectedHotwords.length} 个：{selectedHotwords.slice(0, 3).join(' + ') || '无'}
                {selectedHotwords.length > 3 && ` 等 ${selectedHotwords.length} 个`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {hotwords.map(hw => (
                  <button key={hw.id || hw.word} onClick={() => toggleHotword(hw.word)} style={{
                    padding: '4px 12px', borderRadius: 20,
                    border: '1px solid #dee2e6', fontSize: 12,
                    backgroundColor: selectedHotwords.includes(hw.word) ? '#7c3aed' : '#fff',
                    color: selectedHotwords.includes(hw.word) ? '#fff' : '#495057',
                    cursor: 'pointer',
                  }}>
                    {hw.word} {hw.frequency ? `(${hw.frequency})` : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* 生成按钮 */}
            <div style={panelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>生成数量：</span>
                <input type="range" min={1} max={5} value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#7c3aed' }}>{count}</span>
              </div>
              <button onClick={handleGenerate} disabled={generating || (!selectedContent && !freeBrief)} style={{
                ...btnPrimaryStyle, width: '100%', padding: '14px', fontSize: 15,
                opacity: (generating || (!selectedContent && !freeBrief)) ? 0.5 : 1,
                background: (generating || (!selectedContent && !freeBrief)) ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                boxShadow: (generating || (!selectedContent && !freeBrief)) ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)',
              }}>
                {generating ? '⏳ AI 创作中...' : '🚀 开始生成'}
              </button>
            </div>
          </div>

          {/* 右侧：结果 */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📝 生成结果</span>
              {results.length > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#dcfce7', color: '#15803d' }}>{results.length} 个版本</span>}
            </div>
            {results.length === 0 ? (
              <div style={{ ...panelStyle, textAlign: 'center', padding: 40, color: '#868e96' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 14 }}>选择模板和热词后，点击「开始生成」</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>AI 将基于爆款基因生成 1-5 条原创内容</div>
              </div>
            ) : (
              results.map((r, i) => (
                <div key={i} style={{ ...panelStyle, marginBottom: 12, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#ede9fe', color: '#7c3aed' }}>版本 {i + 1}</span>
                    <button onClick={() => {
                      const txt = (r.generated_title || r.title || '') + '\n\n' + (r.generated_content || r.body || '');
                      navigator.clipboard.writeText(txt);
                      alert('已复制到剪贴板');
                    }} style={{ padding: '4px 12px', border: '1px solid #dee2e6', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 11 }}>
                      📋 复制
                    </button>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#212529', marginBottom: 8 }}>
                    {r.generated_title || r.title}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {r.generated_content || r.body}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* 创作库 */
        <div>
          {savedList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
              <div style={{ fontSize: 14 }}>创作库还是空的，去生成一些内容吧</div>
            </div>
          ) : (
            savedList.map((r) => (
              <div key={r.id} style={{ ...panelStyle, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#868e96' }}>
                    {r.style} · {new Date(r.created_at).toLocaleString('zh-CN')}
                    {r.is_starred && ' ⭐'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => rewriteAPI.toggleStar(r.id).then(() => {
                      setSavedList(prev => prev.map(item => item.id === r.id ? { ...item, is_starred: !item.is_starred } : item));
                    })} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: r.is_starred ? '#fef3c7' : '#fff', border: '1px solid ' + (r.is_starred ? '#fbbf24' : '#dee2e6') }}>
                      {r.is_starred ? '⭐ 已收藏' : '☆ 收藏'}
                    </button>
                    <button onClick={() => rewriteAPI.delete(r.id).then(() => {
                      setSavedList(prev => prev.filter(item => item.id !== r.id));
                    })} style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', color: '#ef4444' }}>
                      删除
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{r.generated_title || r.title}</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {r.generated_content || r.body}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const panelStyle = { padding: 16, marginBottom: 16, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef' };
const selectStyle = { padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 13, outline: 'none' };
const btnPrimaryStyle = { padding: '8px 16px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
