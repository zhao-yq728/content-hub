import { useState, useEffect, useMemo } from 'react';
import { savedAPI } from '../api';

const TYPE_LABELS = {
  topic: { label: '💡 选题', color: '#7c3aed', bg: '#f3f0ff' },
  skill: { label: '🔮 玄学生成', color: '#0ea5e9', bg: '#e0f2fe' },
};

const panel = { padding: 16, marginBottom: 16, borderRadius: 12, backgroundColor: '#fff', border: '1px solid #e9ecef' };

export default function MyCollection({ onRewriteBrief }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');   // '' | 'topic' | 'skill'
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await savedAPI.list());
    } catch (e) {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(it => {
      if (filter && it.type !== filter) return false;
      if (q) {
        const hay = ((it.title || '') + ' ' + (it.body || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, search]);

  const copy = (it) => {
    const text = (it.title ? it.title + '\n\n' : '') + (it.body || '');
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    alert('已复制');
  };

  const del = async (id) => {
    if (!confirm('确定删除这条收藏？')) return;
    await savedAPI.remove(id);
    load();
  };

  const goRewrite = (it) => {
    if (onRewriteBrief) onRewriteBrief((it.title ? it.title + '\n' : '') + (it.body || ''));
  };

  const fmtTime = (t) => {
    try { return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#212529' }}>💡 我的灵感</h2>
        <div style={{ color: '#868e96', fontSize: 13, marginTop: 6 }}>
          一键收藏的选题与玄学生成结果都在这里，跨设备可见、可搜索、可直接去仿写。（收藏存云端 Supabase；若未建表则暂存本机浏览器）
        </div>
      </div>

      {/* 筛选 + 搜索 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ k: '', l: '全部' }, { k: 'topic', l: '💡 选题' }, { k: 'skill', l: '🔮 玄学生成' }].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)} style={{
            padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: filter === t.k ? '#7c3aed' : '#f1f3f5', color: filter === t.k ? '#fff' : '#495057',
          }}>{t.l}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索标题/正文..."
          style={{ flex: 1, minWidth: 160, padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 13, outline: 'none' }} />
        <button onClick={load} disabled={loading} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontSize: 13 }}>🔄 刷新</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>加载中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#868e96' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            {items.length === 0 ? '灵感库还是空的' : '没有匹配的收藏'}
          </div>
          <div style={{ fontSize: 14 }}>
            {items.length === 0
              ? '去「灵感首页」生成选题、或「玄学技能」生成内容后，点 ⭐ 收藏即可沉淀到这里'
              : '换个筛选条件或搜索关键词试试'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(it => {
            const tl = TYPE_LABELS[it.type] || { label: it.type || '收藏', color: '#495057', bg: '#f1f3f5' };
            return (
              <div key={it.id} style={{ padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #ede9fe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: tl.bg, color: tl.color, fontWeight: 600 }}>{tl.label}</span>
                  <span style={{ fontSize: 11, color: '#868e96' }}>{fmtTime(it.created_at)}</span>
                </div>
                {it.title && <div style={{ fontSize: 15, fontWeight: 700, color: '#212529', marginBottom: 6, lineHeight: 1.5 }}>{it.title}</div>}
                {it.body && <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{it.body}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => copy(it)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontSize: 12 }}>📋 复制</button>
                  <button onClick={() => goRewrite(it)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✍️ 去仿写</button>
                  <button onClick={() => del(it.id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>删除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
