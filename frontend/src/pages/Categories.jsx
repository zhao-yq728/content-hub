import { useState, useEffect } from 'react';
import { categoryAPI, contentAPI } from '../api';

export default function Categories({ onCategoryClick }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoryAPI.list().then(data => {
      setCategories(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categoryIcons = {
    '占星星座': '⭐', '玄学命理': '🔮', '情感关系': '💕', '职场成长': '💼',
    '养生健康': '🌿', '变美穿搭': '👗', '生活干货': '📋', '自媒体运营': '📱',
    '赚钱副业': '💰', '带货种草': '🛍️', '家居生活': '🏠', '其他': '📦',
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>加载中...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', margin: 0 }}>分类管理</h2>
        <span style={{ fontSize: 13, color: '#868e96' }}>
          共 {categories.length} 个分类 · {categories.reduce((s, c) => s + (c.content_count || 0), 0)} 条内容
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {categories.map(cat => (
          <div key={cat.name} style={{
            padding: 20, borderRadius: 12, backgroundColor: '#fff', border: '1px solid #e9ecef',
            cursor: 'pointer', transition: 'box-shadow 0.2s',
          }}
            onClick={() => onCategoryClick && onCategoryClick(cat.name)}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{categoryIcons[cat.name] || '📁'}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#212529' }}>{cat.name}</div>
            <div style={{ fontSize: 12, color: '#868e96', marginTop: 4 }}>{cat.description || ''}</div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>{cat.content_count || 0}</div>
              <div style={{ fontSize: 12, color: '#868e96' }}>条内容</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
