import { useState, useEffect } from 'react';
import { contentAPI, deconstructAPI, categoryAPI, BUILTIN_CATEGORIES } from '../api';

export default function ContentLibrary({ onViewDeconstruct, initialFilter = {} }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState(initialFilter.keyword || '');
  const [categoryFilter, setCategoryFilter] = useState(initialFilter.category || '');
  const [deconstructing, setDeconstructing] = useState(null);

  // Add form state
  const [form, setForm] = useState({
    title: '', content_text: '', source_platform: '', source_url: '',
    content_type: 'text', tags: '',
  });

  // Batch import
  const [batchText, setBatchText] = useState('');
  const [showBatch, setShowBatch] = useState(false);

  // Excel import
  const [excelImporting, setExcelImporting] = useState(false);

  // Link import
  const [showLinkImport, setShowLinkImport] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkFetching, setLinkFetching] = useState(false);
  const [linkPreview, setLinkPreview] = useState(null);

  // Batch select/delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Detail view
  const [detailContent, setDetailContent] = useState(null);

  useEffect(() => {
    loadContents(search, categoryFilter);
  }, []);

  const loadContents = async (keyword = '', category = '') => {
    setLoading(true);
    try {
      let data;
      if (keyword || category) {
        data = await contentAPI.search({ keyword, platform: '', category });
      } else {
        data = await contentAPI.list();
      }
      setContents(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    try {
      await contentAPI.create({
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        content_type: form.content_type || 'text',
      });
      setForm({ title: '', content_text: '', source_platform: '', source_url: '', content_type: 'text', tags: '' });
      setShowAdd(false);
      loadContents();
    } catch (e) {
      alert('添加失败: ' + e.message);
    }
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) return;
    const lines = batchText.trim().split('\n').filter(Boolean);
    const items = lines.map(line => {
      const [title, content_text, platform = ''] = line.split('\t');
      return { title: title?.trim() || '', content_text: content_text?.trim() || '', source_platform: platform.trim(), content_type: 'text', tags: [] };
    }).filter(i => i.title);
    if (items.length === 0) return alert('没有识别到有效内容，请确保每行格式：标题[TAB]正文[TAB]平台');
    try {
      await contentAPI.batchImport(items);
      setBatchText('');
      setShowBatch(false);
      loadContents();
    } catch (e) {
      alert('批量导入失败: ' + e.message);
    }
  };

  const handleLinkFetch = async () => {
    if (!linkUrl.trim()) return;
    setLinkFetching(true);
    try {
      const data = await contentAPI.scrapeLink(linkUrl.trim());
      setLinkPreview(data);
    } catch (err) {
      alert(err.message);
    }
    setLinkFetching(false);
  };

  const handleLinkImport = async () => {
    if (!linkPreview) return;
    try {
      await contentAPI.create({
        title: linkPreview.title,
        content_text: linkPreview.body,
        source_platform: linkPreview.platform,
        source_url: linkPreview.url,
        content_type: 'text',
        tags: '',
      });
      setLinkUrl('');
      setLinkPreview(null);
      setShowLinkImport(false);
      loadContents();
    } catch (err) {
      alert('导入失败: ' + err.message);
    }
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelImporting(true);
    try {
      const result = await contentAPI.importExcel(file);
      alert(`成功导入 ${result.count} 条内容！`);
      loadContents();
    } catch (err) {
      alert('Excel 导入失败: ' + err.message);
    }
    setExcelImporting(false);
    e.target.value = '';
  };

  const handleReclassify = async (contentId) => {
    try {
      const { category } = await categoryAPI.autoClassify(contentId);
      loadContents();
      alert(`已重新分类为「${category}」`);
    } catch (e) {
      alert('重新分类失败: ' + e.message);
    }
  };

  const handleReclassifyAll = async () => {
    if (!confirm('确定要重新对所有内容进行智能分类吗？这会覆盖现有分类。')) return;
    try {
      const result = await categoryAPI.reclassifyAll();
      alert(`已重新分类 ${result.count} 条内容！`);
      loadContents();
    } catch (e) {
      alert('批量重新分类失败: ' + e.message);
    }
  };

  const handleDeconstruct = async (contentId) => {
    setDeconstructing(contentId);
    try {
      const result = await deconstructAPI.run(contentId);
      await categoryAPI.autoClassify(contentId);
      loadContents();
      if (onViewDeconstruct) onViewDeconstruct(contentId);
    } catch (e) {
      alert('拆解失败: ' + e.message);
    }
    setDeconstructing(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除这条内容吗？')) return;
    try {
      await contentAPI.delete(id);
      loadContents();
    } catch (e) {
      alert('删除失败: ' + e.message);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(contents.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条内容吗？此操作不可恢复！`)) return;
    setBatchDeleting(true);
    try {
      const result = await contentAPI.batchDelete([...selectedIds]);
      alert(`已删除 ${result.count} 条内容`);
      setSelectedIds(new Set());
      setSelectMode(false);
      // 延迟确保数据库写入完成
      setTimeout(() => loadContents(), 500);
    } catch (e) {
      alert('批量删除失败: ' + e.message);
    }
    setBatchDeleting(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadContents(search, categoryFilter);
  };

  const clearFilter = () => {
    setSearch('');
    setCategoryFilter('');
    loadContents('', '');
  };

  const platformLabels = {
    xiaohongshu: '小红书', douyin: '抖音', shipinhao: '视频号',
    gongzhonghao: '公众号', manual: '手动录入', '': '未标注',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', margin: 0 }}>素材库</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }} style={{
            ...btnSecondaryStyle,
            backgroundColor: selectMode ? '#fef2f2' : '#fff',
            color: selectMode ? '#ef4444' : '#495057',
            border: selectMode ? '1px solid #fecaca' : '1px solid #dee2e6',
          }}>
            {selectMode ? '退出选择' : '批量选择'}
          </button>
          <button onClick={() => { setShowLinkImport(!showLinkImport); setLinkPreview(null); }} style={{
            ...btnSecondaryStyle,
            backgroundColor: showLinkImport ? '#f3f0ff' : '#fff',
            color: showLinkImport ? '#7c3aed' : '#495057',
            border: showLinkImport ? '1px solid #d8b4fe' : '1px solid #dee2e6',
          }}>
            🔗 链接抓取
          </button>
          <label style={{ ...btnSecondaryStyle, cursor: 'pointer', margin: 0, backgroundColor: excelImporting ? '#f3f0ff' : '#fff' }}>
            {excelImporting ? '导入中...' : '📊 Excel'}
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} style={{ display: 'none' }} disabled={excelImporting} />
          </label>
          <button onClick={handleReclassifyAll} style={btnSecondaryStyle} title="对所有内容重新进行智能分类">
            🔄 重新分类
          </button>
          <button onClick={() => setShowAdd(!showAdd)} style={btnPrimaryStyle}>
            + 添加素材
          </button>
        </div>
      </div>

      {/* Batch mode toolbar */}
      {selectMode && contents.length > 0 && (
        <div style={{
          padding: 12, marginBottom: 16, borderRadius: 10,
          backgroundColor: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: '#991b1b' }}>
            已选 <strong>{selectedIds.size}</strong> 条
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={selectAll} style={{ ...btnSmStyle, backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db' }}>
              全选
            </button>
            <button onClick={deselectAll} style={{ ...btnSmStyle, backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db' }}>
              取消全选
            </button>
            <button onClick={handleBatchDelete} disabled={batchDeleting || selectedIds.size === 0}
              style={{ ...btnSmStyle, backgroundColor: '#ef4444', color: '#fff' }}>
              {batchDeleting ? '删除中...' : `删除选中 (${selectedIds.size})`}
            </button>
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              style={{ ...btnSmStyle, backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db' }}>
              退出选择
            </button>
          </div>
        </div>
      )}

      {/* Batch import panel */}
      {showBatch && (
        <div style={panelStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>批量导入（每行一条，格式：标题 Tab 正文 Tab 平台）</h4>
          <textarea
            value={batchText}
            onChange={e => setBatchText(e.target.value)}
            placeholder={"爆款标题的秘密\t小红书爆款标题的5个公式，建议收藏\txiaohongshu\n如何提升完播率\t视频前3秒决定了80%的完播率\tdouyin"}
            rows={6}
            style={textareaStyle}
          />
          <button onClick={handleBatchImport} style={{ ...btnPrimaryStyle, marginTop: 8 }}>导入</button>
        </div>
      )}

      {/* Link import panel */}
      {showLinkImport && (
        <div style={panelStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🔗 链接抓取导入</h4>
          <div style={{ fontSize: 12, color: '#495057', marginBottom: 12, padding: '8px 12px', borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            ✅ 小红书 ｜ ✅ 抖音 ｜ ✅ 公众号 ｜ ✅ 微博 ｜ ✅ 知乎 ｜ ✅ B站<br/>
            ⚠️ 需要本机运行 CDP 代理 + 浏览器已登录对应平台。未运行时仍可手动粘贴。
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              placeholder="粘贴小红书/抖音/公众号/微博/知乎/B站链接"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={handleLinkFetch} disabled={linkFetching || !linkUrl.trim()} style={btnPrimaryStyle}>
              {linkFetching ? '抓取中...' : '尝试抓取'}
            </button>
          </div>
          {/* 手动粘贴区 — 始终显示 */}
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              placeholder="手动粘贴标题 *"
              value={linkPreview?.title || ''}
              onChange={e => setLinkPreview(prev => ({ ...(prev || {}), title: e.target.value }))}
              style={inputStyle}
            />
            <textarea
              placeholder="手动粘贴正文内容"
              value={linkPreview?.body || ''}
              onChange={e => setLinkPreview(prev => ({ ...(prev || {}), body: e.target.value }))}
              rows={4}
              style={textareaStyle}
            />
            <button onClick={handleLinkImport} disabled={!linkUrl.trim() && !(linkPreview?.title || '').trim()} style={btnPrimaryStyle}>
              确认导入
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={panelStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加新素材</h4>
          <div style={{ display: 'grid', gap: 10 }}>
            <input placeholder="标题 *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select value={form.source_platform} onChange={e => setForm({ ...form, source_platform: e.target.value })} style={inputStyle}>
                <option value="">选择平台</option>
                <option value="xiaohongshu">小红书</option>
                <option value="douyin">抖音</option>
                <option value="shipinhao">视频号</option>
                <option value="gongzhonghao">公众号</option>
                <option value="manual">手动录入</option>
              </select>
              <input placeholder="来源链接" value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} style={inputStyle} />
            </div>
            <textarea
              placeholder="正文内容" value={form.content_text}
              onChange={e => setForm({ ...form, content_text: e.target.value })}
              rows={4} style={textareaStyle}
            />
            <input placeholder="标签（逗号分隔）" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} style={inputStyle} />
            <button onClick={handleAdd} style={btnPrimaryStyle}>保存</button>
          </div>
        </div>
      )}

      {/* Search + Category filter */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="搜索关键词..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); loadContents(search, e.target.value); }}
          style={{ ...inputStyle, width: 140 }}
        >
          <option value="">全部分类</option>
          {BUILTIN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          <option value="未分类">未分类</option>
        </select>
        <button type="submit" style={btnPrimaryStyle}>搜索</button>
      </form>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => { setSearch(''); setCategoryFilter(''); loadContents('', ''); }} style={{
          padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          backgroundColor: (!search && !categoryFilter) ? '#7c3aed' : '#fff',
          color: (!search && !categoryFilter) ? '#fff' : '#495057',
          border: '1px solid ' + ((!search && !categoryFilter) ? '#7c3aed' : '#dee2e6'),
          fontWeight: 500,
        }}>
          📚 全部内容
        </button>
        {(search || categoryFilter) && (
          <>
            <span style={{ fontSize: 12, color: '#868e96' }}>
              当前筛选：{search ? `关键词「${search}」` : ''}{search && categoryFilter ? ' + ' : ''}{categoryFilter ? `分类「${categoryFilter}」` : ''}
            </span>
            <button onClick={clearFilter} style={{ fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
              ✕ 清除筛选
            </button>
          </>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#868e96' }}>
          💡 点击任意分类标签可快速筛选该分类全部内容
        </div>
      </div>

      {/* Content list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>加载中...</div>
      ) : contents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#868e96' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            {categoryFilter ? `「${categoryFilter}」分类下还没有内容` : '素材库还是空的'}
          </div>
          <div style={{ fontSize: 14 }}>
            {categoryFilter
              ? '点击「📚 全部内容」查看其他分类，或换条内容试试'
              : '点击"添加素材"录入你的第一条爆款内容'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contents.map(c => (
            <div key={c.id} style={{
              padding: 16, borderRadius: 10, backgroundColor: '#fff',
              border: selectedIds.has(c.id) ? '2px solid #7c3aed' : '1px solid #e9ecef',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              {selectMode && (
                <input type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  style={{ marginTop: 2, width: 18, height: 18, cursor: 'pointer', accentColor: '#7c3aed', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 10,
                    backgroundColor: '#f3f0ff', color: '#7c3aed',
                  }}>
                    {platformLabels[c.source_platform] || '未标注平台'}
                  </span>
                  {c.has_deconstruction && (
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, backgroundColor: '#d1fae5', color: '#059669' }}>
                      ✓ 已拆解
                    </span>
                  )}
                  {/* 分类标签 — 可点击筛选 */}
                  <span
                    onClick={() => { setCategoryFilter(c.category || '未分类'); loadContents(search, c.category || '未分类'); }}
                    style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 10,
                      backgroundColor: categoryFilter === (c.category || '未分类') ? '#7c3aed' : '#fef3c7',
                      color: categoryFilter === (c.category || '未分类') ? '#fff' : '#92400e',
                      cursor: 'pointer', fontWeight: 500,
                      border: '1px solid ' + (categoryFilter === (c.category || '未分类') ? '#7c3aed' : '#fde68a'),
                    }}
                    title="点击查看该分类全部内容"
                  >
                    🏷 {c.category || '未分类'}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#212529', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 12, color: '#868e96', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(c.body || c.content_text)?.substring(0, 120) || '（无正文）'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setDetailContent(c)} style={{ ...btnSmStyle, backgroundColor: '#f3f0ff', color: '#7c3aed', border: '1px solid #d8b4fe' }}>
                  ▶ 查看全文
                </button>
                <button onClick={() => handleReclassify(c.id)} style={{ ...btnSmStyle, backgroundColor: '#fff', color: '#f59e0b', border: '1px solid #fde68a' }} title="对这条内容重新分类">
                  🔄 重分类
                </button>
                {!c.has_deconstruction && (
                  <button
                    onClick={() => handleDeconstruct(c.id)}
                    disabled={deconstructing === c.id}
                    style={{ ...btnSmStyle, backgroundColor: '#7c3aed', color: '#fff' }}
                  >
                    {deconstructing === c.id ? '拆解中...' : '🔬 拆解'}
                  </button>
                )}
                {c.has_deconstruction && (
                  <>
                    <button onClick={() => onViewDeconstruct && onViewDeconstruct(c.id)} style={{ ...btnSmStyle, backgroundColor: '#f3f0ff', color: '#7c3aed' }}>
                      查看拆解
                    </button>
                    <button onClick={() => handleDeconstruct(c.id)} disabled={deconstructing === c.id} style={{ ...btnSmStyle, backgroundColor: '#fff', color: '#7c3aed', border: '1px solid #d8b4fe' }}>
                      {deconstructing === c.id ? '拆解中...' : '🔄 重拆'}
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(c.id)} style={{ ...btnSmStyle, backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fecaca' }}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailContent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDetailContent(null)}>
          <div style={{
            backgroundColor: '#fff', borderRadius: 16, maxWidth: 680, width: '90%', maxHeight: '85vh',
            overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e9ecef',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, backgroundColor: '#f3f0ff', color: '#7c3aed' }}>
                    {platformLabels[detailContent.source_platform] || '未标注平台'}
                  </span>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, backgroundColor: '#fef3c7', color: '#92400e' }}>
                    🏷 {detailContent.category || '未分类'}
                  </span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.4 }}>
                  {detailContent.title}
                </h3>
                {detailContent.source_url && (
                  <a href={detailContent.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', marginTop: 6, display: 'block', textDecoration: 'none' }}>
                    🔗 {detailContent.source_url}
                  </a>
                )}
              </div>
              <button onClick={() => setDetailContent(null)} style={{
                background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af',
                padding: '4px 8px', marginLeft: 12,
              }}>✕</button>
            </div>
            {/* Body */}
            <div style={{ padding: 24 }}>
              <div style={{
                fontSize: 15, color: '#1f2937', lineHeight: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {detailContent.body || detailContent.content_text || '（无正文）'}
              </div>
            </div>
            {/* Footer actions */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #e9ecef',
              display: 'flex', gap: 8, justifyContent: 'flex-end',
            }}>
              <button onClick={() => { setDetailContent(null); }} style={{
                ...btnSecondaryStyle, fontSize: 13,
              }}>关闭</button>
              {!detailContent.has_deconstruction && (
                <button onClick={() => {
                  handleDeconstruct(detailContent.id);
                  setDetailContent(null);
                }} style={btnPrimaryStyle}>
                  🔬 拆解
                </button>
              )}
              <button onClick={() => {
                const t = detailContent.title + '\n\n' + (detailContent.body || detailContent.content_text || '');
                navigator.clipboard.writeText(t);
                alert('已复制标题和正文');
              }} style={{ ...btnSecondaryStyle, fontSize: 13 }}>📋 复制</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8,
  fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
};
const textareaStyle = { ...inputStyle, resize: 'vertical', fontFamily: 'inherit' };
const panelStyle = {
  padding: 16, marginBottom: 20, borderRadius: 10, backgroundColor: '#fff',
  border: '1px solid #e9ecef',
};
const btnPrimaryStyle = {
  padding: '8px 16px', backgroundColor: '#7c3aed', color: '#fff', border: 'none',
  borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
};
const btnSecondaryStyle = {
  padding: '8px 16px', backgroundColor: '#fff', color: '#495057', border: '1px solid #dee2e6',
  borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnSmStyle = {
  padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 12,
  cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500,
};
