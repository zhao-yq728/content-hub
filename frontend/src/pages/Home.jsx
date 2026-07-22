import { useState, useEffect } from 'react';
import { contentAPI, deconstructAPI, hotwordAPI, configAPI } from '../api';

export default function Home({ onNavigate }) {
  const [stats, setStats] = useState({ contents: 0, deconstructed: 0, generated: 0, hotwords: 0 });
  const [config, setConfig] = useState(null);

  useEffect(() => {
    Promise.all([
      contentAPI.list({ limit: 1 }),
      deconstructAPI.list(),
      hotwordAPI.top(5),
      configAPI.get(),
    ]).then(([contents, decons, hotwords, cfg]) => {
      setStats({
        contents: contents.length,
        deconstructed: decons.length,
        generated: 0,
        hotwords: hotwords.length,
      });
      setConfig(cfg);
    }).catch(() => {});
  }, []);

  const quickActions = [
    { label: '添加新素材', desc: '粘贴链接或手动录入内容', icon: '📝', page: 'library' },
    { label: '拆解爆款', desc: '分析爆款内容的基因结构', icon: '🔬', page: 'deconstruct' },
    { label: 'AI 仿写', desc: '基于模板生成全新内容', icon: '✍️', page: 'rewrite' },
    { label: '浏览热词', desc: '查看热词趋势和组合推荐', icon: '🔥', page: 'hotwords' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: '#212529', margin: '0 0 4px' }}>欢迎回来，Jennie</h2>
        <p style={{ fontSize: 14, color: '#868e96', margin: 0 }}>
          采集 → 拆解 → 仿写，让每一篇内容都有爆款基因
        </p>
      </div>

      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="素材总量" value={stats.contents} color="#7c3aed" />
        <StatCard label="已拆解" value={stats.deconstructed} color="#3b82f6" />
        <StatCard label="热词库" value={stats.hotwords} color="#f59e0b" />
        <StatCard label="API 状态" value={config?.apiKey ? '已配置' : '未配置'} color={config?.apiKey ? '#10b981' : '#ef4444'} />
      </div>

      {/* Quick actions */}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#495057', marginBottom: 16 }}>快速操作</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {quickActions.map(action => (
          <button
            key={action.label}
            onClick={() => onNavigate(action.page)}
            style={{
              padding: 20, borderRadius: 12, border: '1px solid #e9ecef',
              backgroundColor: '#fff', textAlign: 'left', cursor: 'pointer',
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{action.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#212529' }}>{action.label}</div>
            <div style={{ fontSize: 13, color: '#868e96', marginTop: 4 }}>{action.desc}</div>
          </button>
        ))}
      </div>

      {/* Workflow hint */}
      <div style={{
        marginTop: 32, padding: 20, borderRadius: 12, backgroundColor: '#f3f0ff',
        border: '1px solid #ddd6fe',
      }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#7c3aed', margin: '0 0 8px' }}>使用流程</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: '#6d28d9' }}>
          <span style={{ backgroundColor: '#ede9fe', padding: '4px 12px', borderRadius: 20 }}>1. 采集入库</span>
          <span>→</span>
          <span style={{ backgroundColor: '#ede9fe', padding: '4px 12px', borderRadius: 20 }}>2. 智能拆解</span>
          <span>→</span>
          <span style={{ backgroundColor: '#ede9fe', padding: '4px 12px', borderRadius: 20 }}>3. 自动分类</span>
          <span>→</span>
          <span style={{ backgroundColor: '#ede9fe', padding: '4px 12px', borderRadius: 20 }}>4. 热词提取</span>
          <span>→</span>
          <span style={{ backgroundColor: '#ede9fe', padding: '4px 12px', borderRadius: 20 }}>5. AI 仿写</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, backgroundColor: '#fff', border: '1px solid #e9ecef' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#868e96', marginTop: 4 }}>{label}</div>
    </div>
  );
}
