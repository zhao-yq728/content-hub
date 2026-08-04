import { useState } from 'react';

const navItems = [
  { key: 'inspire', label: '灵感首页', icon: '🌟' },
  { key: 'skills', label: '玄学技能', icon: '🔮' },
  { key: 'collection', label: '我的灵感', icon: '💡' },
  { key: 'home', label: '工作台', icon: '🏠' },
  { key: 'library', label: '素材库', icon: '📚' },
  { key: 'deconstruct', label: '拆解中心', icon: '🔬' },
  { key: 'rewrite', label: '仿写工坊', icon: '✍️' },
  { key: 'categories', label: '分类管理', icon: '📂' },
  { key: 'hotwords', label: '热词库', icon: '🔥' },
  { key: 'settings', label: '设置', icon: '⚙️' },
];

export default function Layout({ children, currentPage, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, minWidth: 220, backgroundColor: '#fff', borderRight: '1px solid #e9ecef',
        display: 'flex', flexDirection: 'column', padding: '20px 0',
        ...(window.innerWidth < 768 && !mobileMenuOpen ? { display: 'none' } : {}),
        ...(window.innerWidth < 768 ? { position: 'fixed', zIndex: 100, height: '100vh' } : {}),
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #e9ecef' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#7c3aed', margin: 0 }}>内容智库</h1>
          <p style={{ fontSize: 12, color: '#868e96', margin: '4px 0 0' }}>爆款内容智能中枢</p>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => { onNavigate(item.key); setMobileMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 20px', border: 'none', background: currentPage === item.key ? '#f3f0ff' : 'transparent',
                color: currentPage === item.key ? '#7c3aed' : '#495057', fontSize: 14,
                cursor: 'pointer', textAlign: 'left', fontWeight: currentPage === item.key ? 600 : 400,
                borderRight: currentPage === item.key ? '3px solid #7c3aed' : '3px solid transparent',
              }}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          backgroundColor: '#fff', padding: '12px 24px', borderBottom: '1px solid #e9ecef',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: window.innerWidth < 768 ? 'block' : 'none', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
          >
            ☰
          </button>
          <span style={{ fontSize: 14, color: '#868e96' }}>爆款内容智库 v1.0</span>
        </header>
        <div style={{ flex: 1, padding: 24, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
