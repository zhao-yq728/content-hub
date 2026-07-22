import { useState, useEffect } from 'react';
import { configAPI, exportAPI } from '../api';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [apiType, setApiType] = useState('deepseek');
  const [apiUrl, setApiUrl] = useState('https://api.deepseek.com/chat/completions');
  const [model, setModel] = useState('deepseek-chat');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    configAPI.get().then(cfg => {
      if (cfg.apiKey) setHasKey(true);
      if (cfg.apiType) setApiType(cfg.apiType);
      if (cfg.apiUrl) setApiUrl(cfg.apiUrl);
      if (cfg.model) setModel(cfg.model);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim() && !hasKey) {
      setMessage('请输入 API Key');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await configAPI.update({
        apiKey: apiKey.trim() || undefined,
        apiType,
        apiUrl,
        model,
      });
      setMessage('保存成功!');
      setHasKey(true);
      setApiKey('');
    } catch (e) {
      setMessage('保存失败: ' + e.message);
    }
    setSaving(false);
  };

  const handleProvider = (ptype, purl, pmodel) => {
    setApiType(ptype);
    setApiUrl(purl);
    setModel(pmodel);
  };

  const handleExport = () => {
    exportAPI.exportAll();
    setMessage('数据已导出');
    setTimeout(() => setMessage(''), 2000);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    exportAPI.importAll(file).then(() => {
      setMessage('数据导入成功! 请刷新页面');
      setTimeout(() => window.location.reload(), 1500);
    }).catch(err => {
      setMessage('导入失败: ' + err.message);
    }).finally(() => setImporting(false));
  };

  const providers = [
    { name: 'DeepSeek', type: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { name: 'OpenAI', type: 'openai', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
    { name: '通义千问', type: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
    { name: '智谱', type: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-flash' },
  ];

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', marginBottom: 8 }}>设置</h2>
      <p style={{ fontSize: 13, color: '#868e96', marginBottom: 24 }}>
        配置 AI API Key 后，拆解和仿写功能才能使用。
      </p>

      <div style={{
        padding: 14, marginBottom: 20, borderRadius: 10,
        backgroundColor: hasKey ? '#d1fae5' : '#fef3c7',
        border: `1px solid ${hasKey ? '#a7f3d0' : '#fcd34d'}`,
        fontSize: 13, color: hasKey ? '#065f46' : '#92400e',
      }}>
        {hasKey ? '已配置 API Key - AI 拆解和仿写功能可用' : '尚未配置 API Key - 请先配置才能用 AI 功能'}
      </div>

      <div style={panelStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>API 服务商</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {providers.map(p => (
            <button key={p.name} onClick={() => handleProvider(p.type, p.url, p.model)} style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid #dee2e6',
              fontSize: 13, cursor: 'pointer', backgroundColor: apiType === p.type && apiUrl === p.url ? '#f3f0ff' : '#fff',
              color: apiType === p.type && apiUrl === p.url ? '#7c3aed' : '#495057',
              fontWeight: apiType === p.type && apiUrl === p.url ? 600 : 400,
            }}>
              {p.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>API Key</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={hasKey ? '已保存（如需更换请输入新 Key）' : 'sk-...'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => setShowKey(!showKey)} style={{
                padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8,
                backgroundColor: '#fff', cursor: 'pointer', fontSize: 13,
              }}>
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>API 地址</label>
            <input value={apiUrl} onChange={e => setApiUrl(e.target.value)}
              style={inputStyle} placeholder="https://api.deepseek.com/chat/completions" />
          </div>
          <div>
            <label style={labelStyle}>模型名称</label>
            <input value={model} onChange={e => setModel(e.target.value)}
              style={inputStyle} placeholder="deepseek-chat" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{
          ...btnPrimaryStyle, marginTop: 16, width: '100%', padding: 12, fontSize: 14,
        }}>
          {saving ? '保存中...' : '保存设置'}
        </button>

        <button onClick={async () => {
          setMessage('测试中...');
          const result = await configAPI.test();
          setMessage(result.ok ? '✅ API 连接成功！' : '❌ ' + result.error);
        }} style={{
          marginTop: 8, width: '100%', padding: 10, fontSize: 13,
          backgroundColor: '#fff', color: '#7c3aed', border: '1px solid #d8b4fe',
          borderRadius: 8, cursor: 'pointer',
        }}>
          🔍 测试 API 连接
        </button>

        {message && (
          <div style={{ marginTop: 12, fontSize: 13, color: message.includes('成功') || message.includes('导出') ? '#059669' : '#ef4444' }}>
            {message}
          </div>
        )}
      </div>

      {/* 数据备份 */}
      <div style={{ ...panelStyle, marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>数据备份</div>
        <p style={{ fontSize: 13, color: '#868e96', marginBottom: 12 }}>
          数据已保存在云端，所有设备同步。可导出做本地备份。
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleExport} style={{ ...btnPrimaryStyle, backgroundColor: '#059669' }}>
            导出数据
          </button>
          <label style={{ ...btnPrimaryStyle, backgroundColor: '#3b82f6', cursor: 'pointer' }}>
            {importing ? '导入中...' : '导入数据'}
            <input type="file" accept=".json" onChange={handleImport}
              style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#495057', marginBottom: 4 };
const panelStyle = { padding: 20, borderRadius: 12, backgroundColor: '#fff', border: '1px solid #e9ecef' };
const btnPrimaryStyle = { padding: '8px 16px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
