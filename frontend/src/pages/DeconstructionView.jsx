import { useState, useEffect } from 'react';
import { deconstructAPI, contentAPI } from '../api';

export default function DeconstructionView({ contentId, onBack, onRewrite }) {
  const [content, setContent] = useState(null);
  const [decon, setDecon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    if (!contentId) {
      loadList();
      return;
    }
    loadDeconstruction(contentId);
  }, [contentId]);

  const loadDeconstruction = async (id) => {
    setLoading(true);
    try {
      const [c, d] = await Promise.all([contentAPI.get(id), deconstructAPI.get(id)]);
      setContent(c);
      setDecon(d);
    } catch (e) {
      alert('加载失败: ' + e.message);
    }
    setLoading(false);
  };

  const [deconList, setDeconList] = useState([]);

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await deconstructAPI.list();
      setDeconList(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // List view
  if (!contentId && !content) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', marginBottom: 20 }}>拆解中心</h2>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>加载中...</div>
        ) : deconList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#868e96' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔬</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>还没有拆解记录</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>去素材库对内容点击"拆解"开始分析</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deconList.map(d => (
              <div key={d.content_id} style={{
                padding: 14, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }} onClick={() => loadDeconstruction(d.content_id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#212529', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.title || ('内容 #' + d.content_id)}
                  </div>
                  <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>{d.title_formula || '—'}</div>
                  <div style={{ fontSize: 12, color: '#868e96', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.emotion_curve || ''}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed', marginLeft: 12 }}>{d.score || 80}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>加载中...</div>;
  if (!decon) return <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>未找到拆解记录</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>←</button>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#212529', margin: 0 }}>拆解报告</h2>
        </div>
        <button
          onClick={() => onRewrite && onRewrite(contentId)}
          style={{
            padding: '10px 20px', background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ✨ 立即仿写
        </button>
      </div>

      {/* 1. 原文信息区 */}
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#868e96' }}>📌 原文标题</div>
          {content?.platform && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#f3f0ff', color: '#7c3aed' }}>
              {content.platform}
            </span>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#212529', marginBottom: 10 }}>{content?.title}</div>
        {content?.body && (
          <div>
            <div style={{
              fontSize: 13, color: '#495057', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', maxHeight: showFullText ? 'none' : 100, overflow: 'hidden',
              position: 'relative',
            }}>
              {content.body}
              {!showFullText && content.body.length > 100 && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, #fff)' }} />
              )}
            </div>
            {content.body.length > 100 && (
              <button onClick={() => setShowFullText(!showFullText)}
                style={{ marginTop: 6, fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showFullText ? '收起 ▲' : '展开全部正文 ▼'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. 六大核心基因 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#212529' }}>🧬 六大爆款基因</div>
        <button
          onClick={async () => { setLoading(true); await deconstructAPI.run(contentId, true); await loadDeconstruction(contentId); }}
          style={{ fontSize: 12, color: '#7c3aed', background: '#f3f0ff', border: '1px solid #d8b4fe', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
        >
          🔄 重新拆解
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        <GeneCard label="标题公式" value={decon.title_formula} reason={decon.gene_reasons?.title_formula} color="#7c3aed" icon="📝" />
        <GeneCard label="开篇钩子" value={decon.hook_type} reason={decon.gene_reasons?.hook} color="#3b82f6" icon="🎣" />
        <GeneCard label="正文结构" value={decon.content_structure} reason={decon.gene_reasons?.content_structure} color="#10b981" icon="🏗" />
        <GeneCard label="情绪曲线" value={decon.emotion_curve} reason={decon.gene_reasons?.emotion_curve} color="#f59e0b" icon="🌊" />
        <GeneCard label="互动引导" value={decon.engagement_hooks} reason={decon.gene_reasons?.engagement_hooks} color="#ec4899" icon="💬" />
        <GeneCard label="视觉风格" value={decon.visual_style} reason={decon.gene_reasons?.visual_style} color="#6366f1" icon="🎨" />
      </div>

      {/* 3. 可复用爆款基因 */}
      {decon.reusable_genes?.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#212529' }}>♻️ 可复用爆款基因</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#dbeafe', color: '#1e40af' }}>
              {decon.reusable_genes.length} 个
            </span>
          </div>
          {decon.reusable_genes.map((g, i) => (
            <div key={i} style={{
              padding: 12, marginBottom: 8, borderRadius: 8,
              background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%)',
              border: '1px solid #e9d5ff',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>
                {i + 1}. {g.element}
              </div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 6 }}>
                {g.description}
              </div>
              <div style={{
                padding: 6, borderRadius: 6, backgroundColor: 'rgba(124, 58, 237, 0.05)',
                fontSize: 12, color: '#6b21a8', fontStyle: 'italic',
              }}>
                💡 <strong>怎么用：</strong>{g.use_case}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. 金句摘录 */}
      {decon.golden_sentences?.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#212529', marginBottom: 12 }}>💎 金句摘录</div>
          {decon.golden_sentences.map((s, i) => (
            <div key={i} style={{
              fontSize: 14, color: '#495057', lineHeight: 1.7, padding: '10px 14px',
              borderLeft: '3px solid #7c3aed', backgroundColor: '#faf5ff', marginBottom: 8, borderRadius: 4,
            }}>
              "{s}"
            </div>
          ))}
        </div>
      )}

      {/* 5. 综合评分 + 立即仿写 CTA */}
      <div style={{
        ...panelStyle, marginTop: 16,
        background: 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 100%)',
        border: '1px solid #d8b4fe',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: '#6b21a8', marginBottom: 4 }}>综合爆款指数</div>
        <div style={{ fontSize: 56, fontWeight: 700, color: '#7c3aed', lineHeight: 1, marginBottom: 8 }}>
          {decon.score || 85}
        </div>
        <div style={{ fontSize: 13, color: '#6b21a8', marginBottom: 16 }}>
          {decon.score >= 90 ? '🔥 现象级爆款，可直接对标' : decon.score >= 75 ? '✨ 优质内容，值得拆解仿写' : '💪 仍可学习，结构可借鉴'}
        </div>
        <button
          onClick={() => onRewrite && onRewrite(contentId)}
          style={{
            padding: '12px 32px', background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
          }}
        >
          ✨ 用这份拆解生成新内容
        </button>
      </div>
    </div>
  );
}

function GeneCard({ label, value, reason, color, icon }) {
  return (
    <div style={{
      padding: 14, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{icon}</span> {label}
      </div>
      <div style={{ fontSize: 13, color: '#212529', lineHeight: 1.7 }}>{value || '—'}</div>
      {reason && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 6, backgroundColor: '#f9fafb', borderLeft: `3px solid ${color}` }}>
          <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 4 }}>💡 原因</div>
          <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>{reason}</div>
        </div>
      )}
    </div>
  );
}

const panelStyle = {
  padding: 16, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef',
};
