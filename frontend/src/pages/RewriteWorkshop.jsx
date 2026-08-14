import { useState, useEffect, useRef } from 'react';
import { contentAPI, deconstructAPI, rewriteAPI, hotwordAPI, callAIVision } from '../api';
import { CATEGORY_COLORS, classifyWord, groupHotwordsByCategory, mergeWithDefaultHotwords } from '../utils/hotwordCategories';

export default function RewriteWorkshop({ initialContentId, initialBrief, onNavigate }) {
  const [contents, setContents] = useState([]);
  const [hotwords, setHotwords] = useState([]);
  const [selectedContent, setSelectedContent] = useState(initialContentId || null);
  const [freeBrief, setFreeBrief] = useState(initialBrief || '');
  const [selectedHotwords, setSelectedHotwords] = useState([]);
  const [customHotwordInput, setCustomHotwordInput] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [tab, setTab] = useState('generate');
  const [showHelp, setShowHelp] = useState(!initialContentId && !initialBrief);
  const [sourceDecon, setSourceDecon] = useState(null);

  // 模板输入模式：template（选已拆解） / text（粘贴文案） / image（粘贴图片）
  const [templateMode, setTemplateMode] = useState('template');
  const [pastedText, setPastedText] = useState('');
  const [pastedImage, setPastedImage] = useState(null); // base64
  const [imageExtracting, setImageExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const pasteInputRef = useRef(null);

  const loadHotwords = (n = 500) => {
    hotwordAPI.top(n).then(data => {
      const classified = (data || []).map(w => ({ ...w, category: w.category || classifyWord(w.word) }));
      // 用自己素材热词 + 爆款默认热词库补齐，确保每个分类都充足
      const merged = mergeWithDefaultHotwords(classified, 30);
      setHotwords(merged);
    }).catch(console.error);
  };

  useEffect(() => {
    contentAPI.list().then(setContents).catch(console.error);
    loadHotwords();
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

  const addCustomHotword = () => {
    const raw = customHotwordInput.trim();
    if (!raw) return;
    const words = raw.split(/[,，\s]+/).filter(Boolean);
    let added = 0;
    words.forEach(word => {
      if (selectedHotwords.includes(word)) return;
      setSelectedHotwords(prev => [...prev, word]);
      // 也加入热词池，方便后续换一批还能出现
      if (!hotwords.find(h => h.word === word)) {
        const cat = classifyWord(word);
        setHotwords(prev => [...prev, { word, count: 1, category: cat, isDefault: false, isCustom: true }]);
      }
      added++;
    });
    if (added > 0) setCustomHotwordInput('');
  };

  const removeSelectedHotword = (word) => {
    setSelectedHotwords(prev => prev.filter(w => w !== word));
  };

  const toggleCollapse = (cat) => {
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // 处理粘贴事件（支持文案文字 + 图片）
  const handlePaste = async (e) => {
    const clipboard = e.clipboardData || e.clipboardData;
    if (!clipboard) return;

    // 优先处理图片
    const items = clipboard.items;
    let imageFile = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (imageFile) {
      e.preventDefault();
      setTemplateMode('image');
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPastedImage(ev.target.result);
        extractTextFromImage(ev.target.result);
      };
      reader.readAsDataURL(imageFile);
      return;
    }

    // 文本粘贴
    const text = clipboard.getData('text');
    if (text && text.trim()) {
      if (templateMode === 'text' || templateMode === 'image') {
        e.preventDefault();
        setPastedText(prev => prev ? prev + '\n' + text.trim() : text.trim());
      } else {
        // 自动切换到文本模式
        setTemplateMode('text');
      }
    }
  };

  const extractTextFromImage = async (base64) => {
    setImageExtracting(true);
    try {
      const text = await callAIVision(base64, '请提取图片中的全部文字内容，保持段落。只返回文字，不要解释。');
      setExtractedText(text || '');
      setPastedText(text || '');
    } catch (err) {
      alert('图片文字识别失败：' + err.message);
    }
    setImageExtracting(false);
  };

  const handleGenerate = async () => {
    // 判断是否有有效输入
    const hasTemplate = templateMode === 'template' && selectedContent;
    const hasText = (templateMode === 'text' || templateMode === 'image') && pastedText.trim();
    const hasFreeBrief = !!freeBrief.trim();
    if (!hasTemplate && !hasText && !hasFreeBrief) {
      return alert('请先选择模板、粘贴文案/图片，或在灵感首页用「去仿写」带入选题方向');
    }
    setGenerating(true);
    try {
      const data = await rewriteAPI.run({
        content_id: hasTemplate ? selectedContent : null,
        brief: hasFreeBrief ? freeBrief : '',
        source_text: hasText ? pastedText.trim() : '',
        hotwords: selectedHotwords,
        style: 'trend_catcher', // 标记使用爆款复刻技能
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
              { step: '4', title: '选风格+热词', desc: '选择内容类型，可选点击热词作为必须融入的关键词' },
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
            {/* 模板选择：已拆解 / 粘贴文案 / 粘贴图片 */}
            <div style={panelStyle}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>1</span>
                选择爆款模板
              </div>

              {/* 三种输入方式切换 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { k: 'template', label: '📚 已拆解内容' },
                  { k: 'text', label: '📋 粘贴文案' },
                  { k: 'image', label: '🖼️ 粘贴图片' },
                ].map(t => (
                  <button key={t.k} onClick={() => setTemplateMode(t.k)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    border: templateMode === t.k ? '2px solid #7c3aed' : '1px solid #dee2e6',
                    background: templateMode === t.k ? '#f3f0ff' : '#fff',
                    color: templateMode === t.k ? '#7c3aed' : '#495057',
                    fontWeight: templateMode === t.k ? 600 : 400,
                  }}>{t.label}</button>
                ))}
              </div>

              {templateMode === 'template' && (
                <>
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
                </>
              )}

              {templateMode === 'text' && (
                <div>
                  <div style={{ fontSize: 12, color: '#868e96', marginBottom: 8 }}>直接把爆款文案复制粘贴进来，AI 会学习它的风格结构再生成</div>
                  <textarea
                    ref={pasteInputRef}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Ctrl+V 粘贴文案到这里..."
                    style={{ width: '100%', minHeight: 120, padding: 10, borderRadius: 8, border: '1px solid #dee2e6', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#868e96' }}>{pastedText.trim().length} 字</span>
                    <button onClick={() => setPastedText('')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', color: '#495057', fontSize: 11, cursor: 'pointer' }}>清空</button>
                  </div>
                </div>
              )}

              {templateMode === 'image' && (
                <div>
                  <div style={{ fontSize: 12, color: '#868e96', marginBottom: 8 }}>截图后直接 Ctrl+V 粘贴，AI 自动识别图中文字作为仿写素材</div>
                  {!pastedImage ? (
                    <div
                      onPaste={handlePaste}
                      tabIndex={0}
                      style={{ padding: 30, borderRadius: 8, border: '2px dashed #d8b4fe', background: '#faf5ff', textAlign: 'center', color: '#7c3aed', fontSize: 13, cursor: 'pointer', outline: 'none' }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
                      <div>点击此处后按 Ctrl+V 粘贴图片</div>
                      <div style={{ fontSize: 11, color: '#868e96', marginTop: 4 }}>支持微信/网页/文档截图</div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <img src={pastedImage} alt="粘贴的截图" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #e9ecef' }} />
                      {imageExtracting && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', borderRadius: 8 }}>
                          <span style={{ fontSize: 13, color: '#7c3aed' }}>⏳ AI 识别中...</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => { setPastedImage(null); setExtractedText(''); setPastedText(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>删除图片</button>
                        <button onClick={() => extractTextFromImage(pastedImage)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d8b4fe', background: '#f3f0ff', color: '#7c3aed', fontSize: 11, cursor: 'pointer' }}>重新识别</button>
                      </div>
                      {extractedText && (
                        <div style={{ marginTop: 10, padding: 10, background: '#f8f9fa', borderRadius: 6, fontSize: 12, color: '#495057', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                          <div style={{ fontWeight: 600, marginBottom: 4, color: '#212529' }}>识别结果：</div>
                          {extractedText}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 笔记类型 */}
            {/* 爆款复刻模式开关 + 账号风格卡 */}
            <div style={panelStyle}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>2</span>
                爆款复刻模式（已开启）
              </div>
              <div style={{
                padding: 14, borderRadius: 10,
                background: 'linear-gradient(135deg,#fef3c7 0%,#ede9fe 100%)',
                border: '1px solid #d8b4fe',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>🎯</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#7c3aed' }}>已嵌入「爆款复刻创作」技能</span>
                </div>
                <div style={{ fontSize: 12, color: '#5b21b6', lineHeight: 1.6 }}>
                  AI 将按 6 步流程产出：账号风格定位 → 拆解爆款 → 生成专属创作提示词 → 复刻改写 → 合规审核报告
                </div>
              </div>
            </div>

            {/* 热词 */}
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>3</span>
                  选择热词组合（可选）
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => loadHotwords(500)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid #dee2e6',
                    background: '#fff', color: '#495057', fontSize: 11, cursor: 'pointer',
                  }}>🔄 刷新热词</button>
                  <button onClick={() => onNavigate && onNavigate('hotwords')} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid #d8b4fe',
                    background: '#f3f0ff', color: '#7c3aed', fontSize: 11, cursor: 'pointer',
                  }}>🔥 管理热词库</button>
                </div>
              </div>

              {/* 已选热词展示 + 手动添加 */}
              <div style={{ marginBottom: 10 }}>
                {selectedHotwords.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, padding: 10, background: '#f8f9fa', borderRadius: 8 }}>
                    {selectedHotwords.map(word => {
                      const cat = classifyWord(word);
                      return (
                        <span key={word} style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 12,
                          background: CATEGORY_COLORS[cat] || '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {word}
                          <button onClick={() => removeSelectedHotword(word)} style={{
                            width: 16, height: 16, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.3)',
                            color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={customHotwordInput}
                    onChange={e => setCustomHotwordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomHotword(); } }}
                    placeholder="输入热词，按回车添加（可批量用空格/逗号分隔）"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={addCustomHotword} style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff',
                    fontSize: 12, cursor: 'pointer', fontWeight: 500,
                  }}>添加</button>
                </div>
              </div>

              {(() => {
                const { grouped, sortedCategories } = groupHotwordsByCategory(hotwords);
                if (sortedCategories.length === 0) {
                  return (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: '#868e96', fontSize: 13 }}>
                      暂无热词，点击「刷新热词」或去「热词库」添加
                    </div>
                  );
                }
                const PER_CAT = 10;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
                    {sortedCategories.map(cat => {
                      const all = grouped[cat].sort((a, b) => (b.count || 0) - (a.count || 0));
                      const collapsed = collapsedCategories[cat];
                      return (
                        <div key={cat} style={{
                          borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e9ecef',
                          borderLeft: '3px solid ' + (CATEGORY_COLORS[cat] || '#94a3b8'),
                          overflow: 'hidden',
                        }}>
                          <div
                            onClick={() => toggleCollapse(cat)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 12px', cursor: 'pointer', background: '#fafafa',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: CATEGORY_COLORS[cat] || '#475569' }}>🏷 {cat}</span>
                              <span style={{ fontSize: 11, color: '#868e96' }}>(共 {grouped[cat].length} 个)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14, color: '#7c3aed' }}>{collapsed ? '▶' : '▼'}</span>
                            </div>
                          </div>
                          {!collapsed && (
                            <div style={{
                              padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6,
                              maxHeight: 280, overflowY: 'auto',
                            }}>
                              {all.map(hw => {
                                const isSelected = selectedHotwords.includes(hw.word);
                                return (
                                  <span key={hw.id || hw.word} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '4px 4px 4px 10px', borderRadius: 20,
                                    border: '1px solid ' + (isSelected ? CATEGORY_COLORS[cat] || '#7c3aed' : '#dee2e6'),
                                    fontSize: 12,
                                    backgroundColor: isSelected ? (CATEGORY_COLORS[cat] || '#7c3aed') : '#fff',
                                    color: isSelected ? '#fff' : '#495057',
                                    cursor: 'pointer',
                                  }} title={(hw.isDefault ? '系统默认热词 · ' : hw.isCustom ? '自定义热词 · ' : '素材热词 · ') + '频次: ' + (hw.count || hw.frequency || 0)}>
                                    <span onClick={() => toggleHotword(hw.word)} style={{ flex: 1 }}>{hw.word}</span>
                                    <button onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm('确认从热词库删除「' + hw.word + '」？')) {
                                        hotwordAPI.deleteWord(hw.word).then(() => {
                                          setHotwords(prev => prev.filter(h => h.word !== hw.word));
                                          setSelectedHotwords(prev => prev.filter(w => w !== hw.word));
                                        }).catch(err => alert('删除失败: ' + err.message));
                                      }
                                    }} style={{
                                      width: 18, height: 18, borderRadius: 9, border: 'none',
                                      background: isSelected ? 'rgba(255,255,255,0.3)' : '#f1f3f5',
                                      color: isSelected ? '#fff' : '#868e96',
                                      fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      marginLeft: 2,
                                    }} title="从热词库删除">×</button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
              <button onClick={handleGenerate} disabled={generating || (!selectedContent && !freeBrief && !pastedText.trim())} style={{
                ...btnPrimaryStyle, width: '100%', padding: '14px', fontSize: 15,
                opacity: (generating || (!selectedContent && !freeBrief && !pastedText.trim())) ? 0.5 : 1,
                background: (generating || (!selectedContent && !freeBrief && !pastedText.trim())) ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                boxShadow: (generating || (!selectedContent && !freeBrief && !pastedText.trim())) ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)',
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
