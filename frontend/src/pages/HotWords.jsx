import { useState, useEffect } from 'react';
import { hotwordAPI, supabase } from '../api';
import { CATEGORY_COLORS, classifyWord, groupHotwordsByCategory } from '../utils/hotwordCategories';

export default function HotWords({ onNavigate }) {
  const [words, setWords] = useState([]);
  const [trending, setTrending] = useState([]);
  const [comboWord, setComboWord] = useState('');
  const [combinations, setCombinations] = useState([]);
  const [comboLoading, setComboLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newWordBatch, setNewWordBatch] = useState('');
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [previewCat, setPreviewCat] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    hotwordAPI.top(500).then(data => {
      const classified = (data || []).map(w => ({ ...w, category: classifyWord(w.word) }));
      setWords(classified);
    }).catch(console.error);
    hotwordAPI.trending().then(setTrending).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newWord.trim().length >= 1) {
        hotwordAPI.previewCategory(newWord.trim()).then(setPreviewCat).catch(() => setPreviewCat(null));
      } else {
        setPreviewCat(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [newWord]);

  const handleCombo = async () => {
    if (!comboWord.trim()) return;
    setComboLoading(true);
    try {
      const data = await hotwordAPI.combinations(comboWord.trim());
      setCombinations(data);
    } catch (e) { console.error(e); }
    setComboLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await hotwordAPI.refresh();
      load();
    } catch (e) { alert('刷新失败: ' + e.message); }
    setRefreshing(false);
  };

  const handleAdd = async () => {
    if (!newWord.trim()) return;
    setAdding(true);
    try {
      await hotwordAPI.add(newWord.trim());
      setNewWord('');
      setPreviewCat(null);
      load();
    } catch (e) { alert('添加失败: ' + e.message); }
    setAdding(false);
  };

  const handleBatchAdd = async () => {
    if (!newWordBatch.trim()) return;
    const items = newWordBatch.split(/[\\n,，]/).map(w => w.trim()).filter(Boolean);
    if (items.length === 0) return;
    setAdding(true);
    try {
      const result = await hotwordAPI.addMany(items);
      alert('成功添加 ' + result.count + ' 个热词！');
      setNewWordBatch('');
      setShowBatchAdd(false);
      load();
    } catch (e) { alert('批量添加失败: ' + e.message); }
    setAdding(false);
  };

  const handleRecategorize = () => {
    setWords(prev => prev.map(w => ({ ...w, category: classifyWord(w.word) })));
  };

  const handleDelete = async (word) => {
    if (!confirm('确定要删除热词「' + word + '」吗？')) return;
    try {
      await supabase.from('hotwords').delete().eq('word', word);
      load();
    } catch (e) { alert('删除失败: ' + e.message); }
  };

  const { grouped, sortedCategories } = groupHotwordsByCategory(words);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', margin: 0 }}>热词实验室</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRecategorize} style={{
            padding: '6px 14px', backgroundColor: '#f3f0ff', color: '#7c3aed',
            border: '1px solid #d8b4fe', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}>📋 重新分组</button>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            padding: '6px 14px', backgroundColor: '#fff', border: '1px solid #dee2e6',
            borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#495057',
          }}>{refreshing ? '刷新中...' : '🔄 刷新热词'}</button>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>➕ 手动添加热词</div>
          <button onClick={() => setShowBatchAdd(!showBatchAdd)} style={{ fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {showBatchAdd ? '收起' : '批量添加'}
          </button>
        </div>
        {!showBatchAdd ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                placeholder="输入一个热词，如：水逆 / 爆款 / 焦虑"
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ ...inputStyle, width: '100%', paddingRight: 70 }}
              />
              {previewCat && (
                <div style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                  backgroundColor: CATEGORY_COLORS[previewCat.category] || '#94a3b8', color: '#fff',
                }}>
                  {previewCat.category}
                </div>
              )}
            </div>
            <button onClick={handleAdd} disabled={adding || !newWord.trim()} style={btnPrimaryStyle}>
              {adding ? '添加中...' : '添加'}
            </button>
          </div>
        ) : (
          <div>
            <textarea
              placeholder={'多个热词用换行或逗号分隔，如：\n水逆\n爆款\n焦虑\ncrush'}
              value={newWordBatch}
              onChange={e => setNewWordBatch(e.target.value)}
              rows={4}
              style={{ ...textareaStyle, marginBottom: 8 }}
            />
            <div style={{ fontSize: 12, color: '#868e96', marginBottom: 8 }}>
              自动识别词性：人物 / 地点 / 动词 / 名词 / 形容词 / 语气词
            </div>
            <button onClick={handleBatchAdd} disabled={adding || !newWordBatch.trim()} style={btnPrimaryStyle}>
              {adding ? '添加中...' : '批量添加'}
            </button>
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>热词联想组合</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="输入一个热词，如：水逆、爆款、情绪..."
            value={comboWord}
            onChange={e => setComboWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCombo()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleCombo} disabled={comboLoading} style={btnPrimaryStyle}>
            {comboLoading ? '查询中...' : '联想'}
          </button>
        </div>
        {combinations.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#212529', marginBottom: 10 }}>组合灵感</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {combinations.map((c, i) => (
                <div key={i} style={{
                  padding: 12, borderRadius: 8, backgroundColor: '#f8f9fa', border: '1px solid #e9ecef',
                  cursor: 'pointer',
                }} onClick={() => setComboWord(c.word)}>
                  <div style={{ fontSize: 14, color: '#7c3aed', fontWeight: 600, marginBottom: 6 }}>{c.word}</div>
                  {c.parts && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(c.parts).map(([dim, w]) => (
                        <span key={dim} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#fff', color: '#495057', border: '1px solid #dee2e6' }}>
                          {dim}: {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 按分类展示 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#212529', margin: 0 }}>按词性分类</h3>
        <div style={{ fontSize: 12, color: '#868e96' }}>{words.length} 个 · {sortedCategories.length} 类</div>
      </div>

      {sortedCategories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 14 }}>热词库是空的，点上方手动添加或刷新热词</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedCategories.map(cat => (
            <div key={cat} style={{
              padding: 14, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef',
              borderLeft: '3px solid ' + (CATEGORY_COLORS[cat] || '#94a3b8'),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: CATEGORY_COLORS[cat] || '#475569' }}>
                  🏷 {cat}
                </span>
                <span style={{ fontSize: 11, color: '#868e96' }}>({grouped[cat].length} 个)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {grouped[cat].map(w => (
                  <span key={w.word} style={{
                    padding: '4px 10px', borderRadius: 14, backgroundColor: '#f8f9fa',
                    color: '#495057', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
                    cursor: 'pointer',
                  }} onClick={() => setComboWord(w.word)} title={'点击搜索组合 · 频次: ' + w.count}>
                    {w.word}
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>({w.count})</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(w.word); }} style={{
                      background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0,
                    }} title="删除">×</button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle = { padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 14, outline: 'none' };
const textareaStyle = { padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' };
const panelStyle = { padding: 16, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef' };
const btnPrimaryStyle = { padding: '8px 16px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' };
