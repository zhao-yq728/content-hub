// ============================================================
//  云端数据层 — Supabase + AI API
//  数据存云端，任何设备打开同一链接看到同一份数据
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zffvmptqjlfjadrrpxdb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KdpBphg8y9RfoKxqbLwo2Q_OiFdErFG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------- 预设分类 ----------
export const BUILTIN_CATEGORIES = [
  '占星', '玄学', '穿搭', '生活干货', '自媒体运营',
  '赚钱', '带货', '变美', '养生', '职场', '情感', '家居生活',
  '母婴', '美食', '好物', '旅行', '学习',
];

// ---------- 辅助 ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- AI API 调用 ----------
export async function callAI(prompt, systemPrompt) {
  const cfg = await configAPI.get();
  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    throw new Error('API Key 未配置。请在「设置」页面填写 API Key 并保存。');
  }

  // 首选：浏览器直连 AI 服务（GitHub Pages / 任何设备任何网络均可，智谱已支持跨域 CORS）
  const url = cfg.apiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  const model = cfg.model || 'glm-4-flash';
  let resp = null;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt || '你是一个有帮助的AI助手。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });
  } catch (e) {
    // 网络层失败（断网 / CORS 被拦）→ 回退本机代理
    resp = null;
  }

  if (resp) {
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      let msg = errText;
      try { const j = JSON.parse(errText); msg = j.error?.message || j.error?.code || msg; } catch (e) {}
      throw new Error('AI 调用失败：' + String(msg).slice(0, 200) + '（状态码 ' + resp.status + '）');
    }
    const data = await resp.json();
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    throw new Error('AI 返回格式异常：' + JSON.stringify(data).slice(0, 300));
  }

  // 兜底：本机代理（本地开发 / 代理可用时；抓取功能也走这里）
  const proxyUrls = ['https://localhost:3443/ai', 'http://localhost:3457/ai'];
  for (const proxyUrl of proxyUrls) {
    try {
      const proxyResp = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          systemPrompt,
          apiKey: cfg.apiKey,
          apiUrl: cfg.apiUrl,
          model: cfg.model,
        }),
      });
      if (proxyResp.ok) {
        const proxyData = await proxyResp.json();
        if (proxyData.ok) return proxyData.content;
      }
    } catch (e) {
      // 代理不通，试下一个
    }
  }

  throw new Error('AI 调用失败：直连与本地代理均不可用。请确认「设置」里 API Key 正确，或本机已启动抓取代理。');
}

// ============ Content API ============
export const contentAPI = {
  async list(params = {}) {
    let query = supabase.from('contents').select('*').order('created_at', { ascending: false });
    if (params.category && params.category !== '全部') {
      query = query.eq('category', params.category);
    }
    if (params.platform && params.platform !== '全部') {
      query = query.eq('platform', params.platform);
    }
    const { data, error } = await query.limit(500);
    if (error) throw new Error(error.message);
    let items = data || [];
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      items = items.filter(c =>
        (c.title || '').toLowerCase().includes(kw) || (c.body || '').toLowerCase().includes(kw)
      );
    }
    // 关联拆解状态
    if (items.length > 0) {
      const { data: decons } = await supabase.from('deconstructions').select('content_id');
      const deconSet = new Set((decons || []).map(d => d.content_id));
      items = items.map(c => ({ ...c, has_deconstruction: deconSet.has(c.id) }));
    } else {
      items = items.map(c => ({ ...c, has_deconstruction: false }));
    }
    return items;
  },

  async get(id) {
    const { data, error } = await supabase.from('contents').select('*').eq('id', id).single();
    if (error) return null;
    // 关联拆解状态
    const { data: d } = await supabase.from('deconstructions').select('content_id').eq('content_id', id).single();
    return { ...data, has_deconstruction: !!d };
  },

  async create(data) {
    const now = new Date().toISOString();
    const item = {
      id: uid(),
      title: data.title || '',
      body: data.body || data.content_text || '',
      url: data.url || data.source_url || '',
      platform: data.platform || data.source_platform || 'other',
      category: data.category || autoClassify((data.title || '') + ' ' + (data.body || data.content_text || '')),
      created_at: now,
      updated_at: now,
    };
    const { data: result, error } = await supabase.from('contents').insert(item).select().single();
    if (error) throw new Error(error.message);
    extractHotwordsFromItem(item);
    return result;
  },

  async update(id, data) {
    const update = { ...data, updated_at: new Date().toISOString() };
    const { data: result, error } = await supabase.from('contents').update(update).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return result;
  },

  async delete(id) {
    await supabase.from('deconstructions').delete().eq('content_id', id);
    const { data, error } = await supabase.from('contents').delete().eq('id', id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('删除失败：记录不存在或无权限');
    return { ok: true };
  },

  async batchDelete(ids) {
    if (!ids || ids.length === 0) return { ok: true, count: 0 };
    // 先删关联拆解数据
    const { error: deErr } = await supabase.from('deconstructions').delete().in('content_id', ids).select();
    if (deErr) console.warn('拆解删除失败:', deErr.message);
    // 分批删除，并验证返回结果
    let deletedCount = 0;
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { data: deleted, error } = await supabase.from('contents').delete().in('id', batch).select();
      if (error) throw new Error(error.message);
      deletedCount += (deleted || []).length;
    }
    if (deletedCount === 0) {
      throw new Error('删除失败：数据库未返回被删除的记录，请检查 Supabase RLS 策略是否启用 DELETE');
    }
    return { ok: true, count: deletedCount };
  },

  async search(params) {
    return contentAPI.list(params);
  },

  async batchImport(items) {
    const now = new Date().toISOString();
    const newItems = items.map(item => ({
      id: uid(),
      title: item.title || '',
      body: item.body || item.content_text || '',
      url: item.url || '',
      platform: item.platform || 'other',
      category: item.category && item.category.trim()
        ? item.category.trim()
        : autoClassify((item.title || '') + ' ' + (item.body || '')),
      created_at: now,
      updated_at: now,
    }));
    const { data, error } = await supabase.from('contents').insert(newItems).select();
    if (error) throw new Error(error.message);
    newItems.forEach(item => extractHotwordsFromItem(item));
    return { count: newItems.length };
  },

  async importExcel(file) {
    const XLSX = await import('xlsx');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (rows.length === 0) return reject(new Error('Excel 文件为空'));

          // 自动识别列名映射（扩展版，覆盖常见 Excel 表头）
          const headerMap = {
            title: ['标题', 'title', '题目', '文章标题', '名称', 'name', '主题', '话题', '标题列'],
            body: ['正文', 'body', '内容', 'content', 'content_text', '正文内容', '文案', 'copy', 'text', '描述', '文章内容', '详细内容', '摘要', '简介', '介绍', '内文', '完整正文文案', '正文文案', '笔记内容'],
            platform: ['平台', 'platform', '来源', 'source', '渠道', 'channel', 'source_platform', '发布平台', '来源平台', '发布来源'],
            url: ['链接', 'url', '地址', '来源链接', 'source_url', 'link', '原文链接', '网址', '笔记链接'],
            category: ['分类', 'category', '分类标签', '标签分类', '类目', '类型', '内容类型', '领域'],
          };
          const firstRow = rows[0];
          const keys = Object.keys(firstRow);
          const mapping = {};
          for (const [field, aliases] of Object.entries(headerMap)) {
            for (const alias of aliases) {
              const found = keys.find(k => k.toLowerCase().trim() === alias.toLowerCase().trim());
              if (found) { mapping[field] = found; break; }
            }
          }

          // 如果没找到 title 列，默认使用第一列作为标题
          if (!mapping.title && keys.length > 0) mapping.title = keys[0];
          // 如果没找到 body 列，默认使用第二列作为正文
          if (!mapping.body && keys.length > 1) mapping.body = keys[1];

          // 已映射到已知字段的列名集合，其余列都会合并到 body
          const mappedKeys = new Set(Object.values(mapping).filter(Boolean));
          const extraKeys = keys.filter(k => !mappedKeys.has(k));

          const items = rows.map(row => {
            const title = String(mapping.title ? (row[mapping.title] || '') : '');
            let body = String(mapping.body ? (row[mapping.body] || '') : '');

            // 将所有未被识别的列内容全部追加到 body，不丢失任何数据
            for (const key of extraKeys) {
              const val = row[key];
              if (val !== '' && val !== null && val !== undefined) {
                body += (body ? '\n' : '') + key + '：' + String(val);
              }
            }

            return {
              title,
              body,
              platform: String(mapping.platform ? (row[mapping.platform] || '') : ''),
              url: String(mapping.url ? (row[mapping.url] || '') : ''),
              category: String(mapping.category ? (row[mapping.category] || '') : ''),
            };
          }).filter(i => i.title && i.title.trim());

          if (items.length === 0) return reject(new Error('没有识别到有效内容'));
          contentAPI.batchImport(items).then(r => resolve({ count: items.length })).catch(reject);
        } catch (err) {
          reject(new Error('Excel 解析失败: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  },

  async scrapeLink(url) {
    if (!url || !url.trim()) throw new Error('请输入链接');
    const target = url.trim();

    // 识别平台
    let platform = 'other';
    if (/xiaohongshu\.com|xhslink\.com/.test(target)) platform = 'xiaohongshu';
    else if (/douyin\.com|iesdouyin\.com/.test(target)) platform = 'douyin';
    else if (/bilibili\.com/.test(target)) platform = 'bilibili';
    else if (/weibo\.com|weibo\.cn/.test(target)) platform = 'weibo';
    else if (/zhihu\.com/.test(target)) platform = 'zhihu';

    // 第一步：尝试本地 CDP 代理抓取（需要本机运行 cdp-proxy-server.js）
    try {
      const cdpResp = await fetch('http://localhost:3457/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (cdpResp.ok) {
        const cdpData = await cdpResp.json();
        if (cdpData.ok && cdpData.data) {
          const d = cdpData.data;
          // 抖音特殊处理：按「抖音文案一键提取」格式输出
          if (platform === 'douyin') {
            const formatted = formatDouyinExtract(d);
            return {
              title: d.title || '未识别标题',
              body: formatted,
              url: target,
              platform: 'douyin',
            };
          }
          return {
            title: d.title || '未识别标题',
            body: d.text || d.body || '',
            url: target,
            platform: d.platform || platform,
          };
        }
      }
    } catch (e) {
      // CDP 不可用，继续尝试其他方式
    }

    // 第二步：小红书/抖音 — CDP 不可用时告知用户启动本地代理
    if (platform === 'xiaohongshu' || platform === 'douyin') {
      throw new Error(
        '本地 CDP 抓取代理未启动。\n\n' +
        '请在电脑上运行: node cdp-proxy-server.js\n' +
        '并确保浏览器已开启调试模式（--remote-debugging-port=9222）。\n\n' +
        '或直接在下方手动粘贴标题和正文。'
      );
    }

    // 第三步：其他平台尝试公开 CORS 代理
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
      `https://corsproxy.io/?${encodeURIComponent(target)}`,
    ];

    let html = '';
    for (const proxy of proxies) {
      try {
        const resp = await fetch(proxy, { method: 'GET' });
        if (resp.ok) {
          html = await resp.text();
          if (html && html.length > 100) break;
        }
      } catch (e) { /* try next */ }
    }

    if (!html || html.length < 200) {
      throw new Error('自动抓取失败，请复制标题和正文手动粘贴。');
    }

    if (html.includes('请在App内打开') || html.includes('请使用APP')) {
      throw new Error('该平台要求App内查看，无法从网页自动抓取。请在App中复制内容后手动粘贴。\n\n链接：' + target);
    }

    let title = '';
    const ogTitle = html.match(/<meta[^>]*property=[\"']og:title[\"'][^>]*content=[\"']([^\"']*)[\"']/i);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    title = (ogTitle?.[1] || titleTag?.[1] || '').trim();

    let body = '';
    const ogDesc = html.match(/<meta[^>]*property=[\"']og:description[\"'][^>]*content=[\"']([^\"']*)[\"']/i);
    const metaDesc = html.match(/<meta[^>]*name=[\"']description[\"'][^>]*content=[\"']([^\"']*)[\"']/i);
    body = (ogDesc?.[1] || metaDesc?.[1] || '').trim();

    if (!title && !body) {
      throw new Error('无法从页面中提取内容，请手动粘贴。\n\n链接：' + target);
    }

    return { title: title || '未识别标题', body, url: target, platform };
  },
};

// ============ Deconstruction API ============
// 写库容错：若 deconstructions 表尚未加 gene_reasons 列（用户未跑 supabase_decon_reasons.sql），
// 自动去掉该字段重试，避免整个拆解因缺列而失败（原因区会降级为空，但不影响拆解主流程）。
async function upsertDeconstruction(record) {
  try {
    const { error } = await supabase.from('deconstructions').upsert(record);
    if (error) throw error;
  } catch (e) {
    const msg = (e && (e.message || e.code || '')) + '';
    if (/gene_reasons/i.test(msg)) {
      const { gene_reasons, ...rest } = record;
      const { error: e2 } = await supabase.from('deconstructions').upsert(rest);
      if (e2) throw e2;
    } else {
      throw e;
    }
  }
}

export const deconstructAPI = {
  async list() {
    const { data: decons, error: e1 } = await supabase.from('deconstructions').select('*');
    if (e1) throw new Error(e1.message);
    if (!decons || decons.length === 0) return [];
    const ids = decons.map(d => d.content_id);
    const { data: contents, error: e2 } = await supabase.from('contents').select('*').in('id', ids);
    if (e2) throw new Error(e2.message);
    const contentMap = {};
    (contents || []).forEach(c => { contentMap[c.id] = c; });
    return decons.map(d => ({
      content_id: d.content_id,
      title: contentMap[d.content_id]?.title || '',
      platform: contentMap[d.content_id]?.platform || '',
      category: contentMap[d.content_id]?.category || '',
      title_formula: d.title_pattern || '',
      hook_type: d.hook || '',
      emotion_curve: d.emotion_curve || '',
      engagement_hooks: d.interaction || '',
      visual_style: d.ending || '',
      content_structure: d.structure || '',
      gene_reasons: d.gene_reasons || {},
      key_elements: d.key_elements || [],
      golden_sentences: Array.isArray(d.key_elements) ? d.key_elements.slice(0, 3) : [],
      reusable_genes: (d.key_elements || []).map(el => ({
        element: typeof el === 'string' ? el : el.element,
        description: typeof el === 'string' ? '可在同类内容中复用' : el.description,
        use_case: typeof el === 'string' ? '替换主题后再次使用' : el.use_case,
      })).slice(0, 4),
      score: d.score || Math.round(75 + Math.random() * 15),
      analyzed_at: d.analyzed_at,
    }));
  },

  async get(contentId) {
    const { data: c, error: e1 } = await supabase.from('contents').select('*').eq('id', contentId).single();
    if (e1 || !c) return null;
    const { data: d, error: e2 } = await supabase.from('deconstructions').select('*').eq('content_id', contentId).single();
    if (e2 || !d) {
      return { content_id: contentId, title: c.title, platform: c.platform };
    }
      return {
        content_id: contentId,
        title: c.title,
        platform: c.platform,
        category: c.category || '',
        title_formula: d.title_pattern || '',
        hook_type: d.hook || '',
        emotion_curve: d.emotion_curve || '',
        engagement_hooks: d.interaction || '',
        visual_style: d.ending || '',
        content_structure: d.structure || '',
        gene_reasons: d.gene_reasons || {},
        key_elements: d.key_elements || [],
        golden_sentences: Array.isArray(d.key_elements) ? d.key_elements.slice(0, 3) : [],
        reusable_genes: (d.key_elements || []).map(el => ({
          element: typeof el === 'string' ? el : el.element,
          description: typeof el === 'string' ? '可在同类内容中复用' : el.description,
          use_case: typeof el === 'string' ? '替换主题后再次使用' : el.use_case,
        })).slice(0, 4),
        score: d.score || Math.round(75 + Math.random() * 15),
        analyzed_at: d.analyzed_at,
      };
  },

  async run(contentId, force = false) {
    const c = await contentAPI.get(contentId);
    if (!c) throw new Error('内容不存在');

    const existing = await deconstructAPI.get(contentId);
    if (!force && existing && existing.title_formula) {
      return existing;
    }

    const prompt = `请深度拆解以下爆款内容。要求：六大爆款基因的每一条都要同时给出"结论/公式"、"原文对应的具体表现"、"底层原因"（必须结合原文细节，不能泛泛而谈）。

用 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "title_pattern": "标题公式结论（如：个人权威+绝对化宣言型）+ 原文具体表现 + 为什么这么写有效",
  "hook": "开篇钩子结论 + 原文如何开篇 + 为什么能抓前3秒",
  "emotion_curve": "情绪节奏结论 + 原文中情绪如何递进 + 为什么这种递进能留住人",
  "interaction": "互动引导结论 + 原文如何引导互动 + 为什么能带动评论/收藏/转发",
  "ending": "结尾布局结论 + 原文结尾怎么收 + 为什么能促进转化/行动",
  "structure": "正文结构结论 + 原文框架拆解 + 为什么这种结构适合这个选题",
  "gene_reasons": {
    "title_formula": "30-50字：这个标题公式为什么对目标读者有效，必须引用原文细节",
    "hook": "30-50字：这个开篇为什么能抓住目标人群，必须引用原文细节",
    "content_structure": "30-50字：这个结构为什么能让信息更好吸收",
    "emotion_curve": "30-50字：这种情绪曲线为什么能提升完播/收藏",
    "engagement_hooks": "30-50字：这种互动引导为什么能获得反馈",
    "visual_style": "30-50字：这种视觉/收尾风格为什么适合平台算法或用户心理"
  },
  "reusable_genes": [
    {"element":"基因名称（如：钩子前置、情绪反差、身份代入等）","description":"该基因在原文中的具体作用机制，必须结合原文","use_case":"如何在自己的内容里复用，30字内"}
  ],
  "golden_sentences": ["原文最有冲击力的3个金句，原文摘录不要改写"]
}

要求：
- 不要泛泛而谈，每条拆解必须回到原文具体词句/结构。
- title_pattern/hook/.../structure 字段本身要包含"结论+原文表现+原因"，字数可以放宽到80-120字。
- gene_reasons 单独提炼一句话原因，必须解释"为什么有效"。
- reusable_genes：列出3-4个真正的爆款基因（不是关键词），每个必须说明原文机制+用法。
- golden_sentences：从原文摘出3个最有力的金句。

内容：
标题：${c.title}
正文：${(c.body || '').slice(0, 2500)}`;

    const fallbackReasons = {
      title_formula: '标题用绝对化/权威化表达降低用户决策成本，同时承诺覆盖多场景，直击"怕买错"心理。',
      hook: '开篇直接点出目标场景（面试/初入职场），让读者立刻对号入座，建立"这就是为我写的"感觉。',
      content_structure: '总-分-总结构先给结论，再用分点论据降低阅读成本，最后回扣场景强化记忆。',
      emotion_curve: '从"好奇为什么"到"信服细节"再到"安心能胜任"，情绪递进贴合用户购买/收藏决策路径。',
      engagement_hooks: '用场景清单和话题标签覆盖多个搜索入口，刺激读者在评论区补充/求同款。',
      visual_style: '结尾总结+身份标签收尾，既强化记忆点，也方便平台算法识别垂类内容。',
    };

    try {
      const result = await callAI(prompt, '你是一个顶级内容策划师，擅长从原文细节中提炼爆款逻辑。只返回JSON格式。');
      const parsed = JSON.parse(result.replace(/```json\n?/g, '').replace(/```/g, '').trim());
      const reusableGenes = Array.isArray(parsed.reusable_genes) ? parsed.reusable_genes : [];
      const goldenSents = Array.isArray(parsed.golden_sentences) ? parsed.golden_sentences : [];
      const geneReasons = parsed.gene_reasons || fallbackReasons;
      const record = {
        content_id: contentId,
        title_pattern: parsed.title_pattern || '',
        hook: parsed.hook || '',
        emotion_curve: parsed.emotion_curve || '',
        interaction: parsed.interaction || '',
        ending: parsed.ending || '',
        key_elements: parsed.key_elements || reusableGenes.map(g => g.element) || [],
        structure: parsed.structure || '',
        gene_reasons: geneReasons,
        reusable_genes: reusableGenes,
        golden_sentences: goldenSents,
        analyzed_at: new Date().toISOString(),
      };
      await upsertDeconstruction(record);
      if (c.category === '未分类') {
        await contentAPI.update(contentId, { category: autoClassify(c.title + ' ' + (c.body || '')) });
      }
      const stored = await deconstructAPI.get(contentId);
      const safeReasons = (stored.gene_reasons && Object.keys(stored.gene_reasons).length) ? stored.gene_reasons : record.gene_reasons;
      return { ...stored, gene_reasons: safeReasons };
    } catch (e) {
      const fallback = {
        content_id: contentId,
        title: c.title,
        platform: c.platform,
        category: c.category || '',
        title_formula: detectTitlePattern(c.title),
        hook_type: '开篇直接锁定目标场景（如面试/初入职场），用"这件衬衫我愿称之为..."建立个人权威感，让读者立刻对号入座。原因：精准场景+权威背书能快速抓住前3秒注意力。',
        emotion_curve: '好奇（为什么能应付所有场合）→ 信服（版型/领口/上身细节论证）→ 安心（所有正式场合都合适）→ 行动（收藏/购买）。原因：情绪递进贴合用户从怀疑到信任的决策路径。',
        engagement_hooks: '通过"春招/秋招/实习面试/入职报到/日常通勤"场景清单+多组 hashtag 覆盖搜索入口，引导评论区"求链接/同款"。原因：场景越具体，用户评论的钩子越明确。',
        visual_style: '结尾用"所有正式场合都合适，职场新人必备"总结观点，并叠加身份标签和话题标签。原因：总结句强化记忆点，标签帮助算法推荐给精准人群。',
        content_structure: '总-分-总结构：先用"我愿称之为能应付所有正式场合的衬衫"给出总承诺，再分点论证版型/领口/上身/场景，最后回扣"职场新人必备"。原因：结论先行降低阅读成本，分点论证提升可信度。',
        gene_reasons: fallbackReasons,
        key_elements: extractKeywords(c.title + (c.body || ''), 5),
        golden_sentences: extractKeywords(c.title + (c.body || ''), 3).map(k => `围绕"${k}"展开的金句`),
        reusable_genes: [
          { element: '权威背书开场', description: '用"我愿称之为"建立个人话语权，比官方推荐更像真实体验', use_case: '测评/种草类内容开头可用"我愿称之为XX天花板"' },
          { element: '绝对化承诺', description: '"所有正式场合"覆盖全场景，降低用户"怕买错"焦虑', use_case: '产品种草用"一件搞定XX"替代"适合多种场景"' },
          { element: '场景清单收尾', description: '把使用场景一一列尽，让用户自行对号入座', use_case: '结尾用"XX/XX/XX 都适合"激发收藏欲' },
          { element: '痛点细节论证', description: '从版型/领口/上身感等具体维度打消顾虑', use_case: '不要只说"好穿"，要拆"不塌领/不皱巴巴/不紧绷"' },
        ],
        score: Math.round(78 + Math.random() * 12),
        analyzed_at: new Date().toISOString(),
      };
      await upsertDeconstruction({
        content_id: contentId,
        title_pattern: fallback.title_formula,
        hook: fallback.hook_type,
        emotion_curve: fallback.emotion_curve,
        interaction: fallback.engagement_hooks,
        ending: fallback.visual_style,
        key_elements: fallback.key_elements,
        structure: fallback.content_structure,
        gene_reasons: fallbackReasons,
        analyzed_at: fallback.analyzed_at,
      });
      if (c.category === '未分类') {
        await contentAPI.update(contentId, { category: autoClassify(c.title + ' ' + (c.body || '')) });
      }
      return fallback;
    }
  },

  async delete(contentId) {
    const { error } = await supabase.from('deconstructions').delete().eq('content_id', contentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};

// ============ Rewrite API ============
export const rewriteAPI = {
  async list() {
    const { data, error } = await supabase.from('rewrites').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async run(data) {
    const { content_id, brief, style = 'default', hotwords = '', count = 3 } = data;
    const n = Math.min(Math.max(parseInt(count) || 3, 1), 5);

    const styleMap = {
      review: '种草测评型：「亲身体验+真实对比」，结构=痛点共鸣→产品引入→分维度对比→推荐结论。像买回家用了两周在群里跟闺蜜分享的感觉',
      tutorial: '干货教程型：「步骤清晰+可复制」，结构=问题场景→解决方法→分步操作→效果展示。像给朋友发微信教她做一件事，每一步都具体可执行',
      vlog: 'Vlog叙事型：「故事线+情绪起伏」，结构=开始状态→转折事件→解决方案→结果+感受。像写日记一样有具体时间地点细节',
      collection: '合集盘点型：「筛选标准+多维对比」，结构=需求定义→筛选标准→分项推荐→总结对比。每个推荐项有具体来源和使用感受',
      avoid: '避雷拔草型：「踩坑经历+真相揭露」，结构=期待vs现实→问题罗列→替代方案→省钱建议。吐槽真实不夸张，建议真诚',
      default: '自然真人感：像朋友聊天一样，有语气词、有停顿、有真实的小犹豫，不要完美排比',
      healing: '治愈系：温柔、共情、像在深夜陪人说话，允许句子长短不齐，带一点呼吸感',
      sharp: '犀利系：观点直接、有态度、敢下判断，像闺蜜吐槽或过来人拍醒你',
      dry: '干货系：结构清晰但不像说明书，加入"我踩过的坑""说人话就是"等口语表达',
      story: '故事系：有画面、有细节、有具体场景，像讲一件刚发生的事',
    };

    const hotwordText = Array.isArray(hotwords) ? hotwords.join('、') : (hotwords || '');
    const hotwordInject = hotwordText ? '\n需要自然融入的热词（不要生硬堆砌）：' + hotwordText : '';

    // 构建 JSON 模板字符串（避免嵌套模板字面量）
    let exampleItems = '';
    for (let i = 1; i <= n; i++) {
      if (i > 1) exampleItems += ',';
      exampleItems += '{"title":"标题' + i + '","body":"正文' + i + '","angle":"角度' + String.fromCharCode(64 + i) + '"}';
    }

    // 公共写作规则（两种模式共用）
    const writingRules =
      '【去 AI 味写作要求】\n' +
      '1. 标题要像真人刷到会点进去的样子，可以用emoji、数字、问句、感叹，但不要全是套路\n' +
      '2. 正文开头不要"大家好""今天来分享"，直接进场景或进情绪\n' +
      '3. 允许有"其实吧""说实话""我自己是""不知道你们有没有"这类口语\n' +
      '4. 长短句交错，不要每段都一样长\n' +
      '5. 少用"首先/其次/最后/综上所述"，多用"然后""结果""关键是""让我意外的是"\n' +
      '6. 加入一个具体细节（时间、地点、物品、感受）让内容更真实\n' +
      '7. 结尾不是总结，而是抛一个问题、留一个钩子、或者一句让人想评论的话\n\n' +
      '【小红书排版规范 - 严格遵守】\n' +
      '1. 每段不超过3行，段落之间用空行分隔\n' +
      '2. 关键产品名、价格、数据用【】标记，如【29元】\n' +
      '3. 适量使用emoji（每段1-2个即可，不要堆砌）\n' +
      '4. 正文控制在250-500字，不要太长\n' +
      '5. 不要用"好物分享""亲测有效"这种模板化开头\n' +
      '6. 标签必须用#号开头，附在正文后面\n\n' +
      '【输出格式】\n' +
      '用JSON格式返回（不要其他文字，不要 ```json 包装）：\n' +
      '{"items":[' + exampleItems + ']}';

    let prompt;
    let saveContentId = content_id;

    if (content_id) {
      // ---------- 模板仿写模式 ----------
      const c = await contentAPI.get(content_id);
      const decon = await deconstructAPI.get(content_id);
      const geneText = (decon?.reusable_genes || []).map(g =>
        '- 【' + g.element + '】' + g.description + ' 用法：' + g.use_case
      ).join('\n');

      prompt =
        '你是一个真人博主，正在写一条要发在小红书/抖音的内容。请基于下面这份【爆款拆解】，生成 ' + n + ' 条**同领域、不同角度**的二次创作。\n' +
        '【风格要求】' + (styleMap[style] || styleMap.default) + hotwordInject + '\n\n' +
        '【原始标题】' + (c?.title || '') + '\n' +
        '【原始正文（不要照抄，但要保留核心场景和人物设定）】\n' + ((c?.body || '').slice(0, 1500)) + '\n\n' +
        '【爆款拆解 - 内在基因】\n' +
        '标题公式：' + (decon?.title_formula || '') + '\n' +
        '开篇钩子：' + (decon?.hook_type || '') + '\n' +
        '情绪曲线：' + (decon?.emotion_curve || '') + '\n' +
        '互动引导：' + (decon?.engagement_hooks || '') + '\n' +
        '结尾布局：' + (decon?.visual_style || '') + '\n' +
        '正文结构：' + (decon?.content_structure || '') + '\n' +
        (geneText ? '可复用爆款基因：\n' + geneText + '\n' : '') +
        '【金句摘录（仅作风格参考，词句不照搬）】\n' + ((decon?.golden_sentences || []).slice(0, 3).join('\n')) + '\n\n' +
        '【核心要求 - 严格遵守】\n' +
        '1. 【同领域】主题必须和原文一致，原文讲什么就讲什么 — 讲美妆就讲美妆，讲穿搭就讲穿搭，讲美食就讲美食。**严禁换领域**\n' +
        '2. 【同受众】目标人群保持一致（小白/新手/学生/上班族等定位不变）\n' +
        '3. 【同结构】复用原文的【标题公式+开篇钩子+情绪节奏+互动引导】，不要换结构\n' +
        '4. 【不同角度】可以换的是：具体场景、人设、切入点、产品类型、情绪细节、出场顺序\n' +
        '5. 原文讲"10分钟早八淡妆" → 你可以写"10分钟约会妆/通勤妆/面试妆/健身房妆容"，**都是美妆不同场景**\n' +
        '6. 原文讲"5套法式穿搭" → 你可以写"5套学院风/通勤风/约会风穿搭"，**都是穿搭不同风格**\n' +
        '7. 原文讲"省钱存钱" → 你可以写"存钱工具/存钱挑战/副业存钱"，**都是理财不同方法**\n' +
        '8. 原文讲的具体细节（品牌、地址、价格、地点、人物）可以替换，但【行业/品类/痛点】必须保留\n\n' +
        writingRules;
    } else if (brief && brief.trim()) {
      // ---------- 自由选题模式（灵感首页「去仿写」入口） ----------
      saveContentId = null;
      prompt =
        '你是一个真人博主（疗愈/玄学/占星内容方向），正在写一条要发在小红书/抖音的内容。下面是我已经定好的【选题方向】，请围绕它生成 ' + n + ' 条**不同角度**的成品内容。\n' +
        '【风格要求】' + (styleMap[style] || styleMap.default) + hotwordInject + '\n\n' +
        '【选题方向（已定，主题保持一致，可从不同切入角度展开）】\n' + brief.trim() + '\n\n' +
        '【核心要求】\n' +
        '1. 主题必须围绕上面的选题方向，不要跑题\n' +
        '2. 每条内容角度要有差异（不同人群/不同场景/不同情绪点/不同争议点）\n' +
        '3. 内容要有疗愈/玄学/占星的专业感但不端着，像懂行的朋友在分享\n' +
        '4. 可结合当下天象（水逆、满月、新月、行星换座等）增加时效性和共鸣\n\n' +
        writingRules;
    } else {
      throw new Error('请先选择模板，或在灵感首页用「去仿写」带入选题方向');
    }

    try {
      const result = await callAI(prompt, '你是爆款内容专家，擅长结构仿写。只返回纯JSON，不要任何额外文字。');
      let cleaned = result.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        throw new Error('AI 返回数据格式异常：未包含 items 数组');
      }
      const items = parsed.items.map((item) => ({
        id: uid(),
        content_id: saveContentId,
        brief: saveContentId ? undefined : brief.trim().slice(0, 200),
        title: item.title || '未命名',
        body: item.body || '',
        style,
        created_at: new Date().toISOString(),
        starred: false,
      }));
      const { error } = await supabase.from('rewrites').insert(items);
      if (error) throw new Error('保存失败: ' + error.message);
      return { items };
    } catch (e) {
      // 把真实错误抛出给前端，不静默吞掉
      throw new Error('仿写生成失败：' + e.message + '\n\n排查步骤：\n1. 设置页检查 API Key 是否已配置\n2. 点「测试 API 连接」验证 Key 有效性\n3. 检查余额/限流');
    }
  },

  async toggleStar(id) {
    const { data: item } = await supabase.from('rewrites').select('*').eq('id', id).single();
    if (!item) return null;
    const { data: result, error } = await supabase.from('rewrites').update({ starred: !item.starred }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return result;
  },

  async delete(id) {
    const { error } = await supabase.from('rewrites').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};

// ============ Category API ============
export const categoryAPI = {
  async list() {
    const { data, error } = await supabase.from('contents').select('category');
    if (error) throw new Error(error.message);
    const counts = {};
    (data || []).forEach(c => {
      const cat = c.category || '未分类';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const allCats = [...BUILTIN_CATEGORIES, '未分类'];
    return allCats.map(name => ({ name, count: counts[name] || 0 })).filter(cat => cat.count > 0);
  },

  async autoClassify(contentId) {
    const c = await contentAPI.get(contentId);
    if (!c) throw new Error('未找到');
    const category = autoClassify((c.title || '') + ' ' + (c.body || ''));
    await contentAPI.update(contentId, { category });
    return { category };
  },

  async reclassifyAll() {
    const { data: items, error } = await supabase.from('contents').select('id, title, body');
    if (error) throw new Error(error.message);
    const updates = (items || []).map(c => ({
      id: c.id,
      category: autoClassify((c.title || '') + ' ' + (c.body || '')),
    }));
    if (updates.length === 0) return { count: 0 };
    const { error: uErr } = await supabase.from('contents').upsert(updates);
    if (uErr) throw new Error(uErr.message);
    return { count: updates.length };
  },
};

// ============ HotWords API ============
export const hotwordAPI = {
  async list() {
    const { data, error } = await supabase.from('hotwords').select('*').order('count', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async top(n = 20) {
    const { data, error } = await supabase.from('hotwords').select('*').order('count', { ascending: false }).limit(n);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async combinations(word) {
    if (!word) return [];

    // 五维联想词库：任务 + 场景 + 心情 + 物品 + 感受
    const dimensions = {
      任务: ['穿搭', '护肤', '化妆', '减肥', '健身', '学习', '工作', '创业', '自媒体', '写作', '读书', '做饭', '整理', '旅行', '拍照', '直播', '带货', '恋爱', '相亲', '带娃', '通勤', '加班', '升职', '跳槽', '面试', '备考', '养生'],
      场景: ['上班', '下班', '约会', '聚会', '旅行', '居家', '睡前', '周末', '早晨', '通勤', '办公室', '健身房', '咖啡馆', '地铁', '机场', '海边', '下雨天', '冬天', '夏天', '春天', '秋天', '深夜', '清晨', '独处'],
      心情: ['焦虑', '开心', '疲惫', '治愈', '崩溃', '迷茫', '孤独', '兴奋', '平静', '烦躁', '期待', '失落', '温暖', '安心', '紧张', '松弛', '自在', '满足', '委屈', '勇敢', '敏感', '无力'],
      物品: ['口红', '咖啡', '手机', '包包', '面膜', '耳机', '书', '笔记本', '香薰', '蜡烛', '奶茶', '运动鞋', '裙子', '西装', '眼镜', '手表', '枕头', '毯子', '植物', '镜子', '水杯', '背包', '耳机'],
      感受: ['松弛', '紧绷', '清爽', '温暖', '安心', '焦虑', '轻盈', '沉重', '踏实', '漂浮', '刺痛', '柔软', '清醒', '困倦', '满足', '空虚', '充盈', '干燥', '湿润', '明亮', '胸闷', '释然'],
    };

    // 判断输入词属于哪个维度
    let inputDim = null;
    for (const [dim, words] of Object.entries(dimensions)) {
      if (words.includes(word)) { inputDim = dim; break; }
    }

    const { data: contents, error } = await supabase.from('contents').select('title, body').limit(500);
    if (error) throw new Error(error.message);

    // 找到与输入词共现的内容
    const relatedContents = (contents || []).filter(c => {
      const t = (c.title || '') + ' ' + (c.body || '');
      return t.includes(word);
    });

    // 从其他维度中找出在该内容集合中出现频率最高的词
    const dimScores = {};
    for (const [dim, words] of Object.entries(dimensions)) {
      if (dim === inputDim) continue;
      dimScores[dim] = {};
      for (const w of words) {
        let score = 0;
        for (const c of relatedContents) {
          const t = (c.title || '') + ' ' + (c.body || '');
          if (t.includes(w)) score++;
        }
        if (score > 0) dimScores[dim][w] = score;
      }
    }

    // 生成组合：输入词 + 每个其他维度 Top1 词
    const combos = [];
    const otherDims = Object.keys(dimensions).filter(d => d !== inputDim);

    // 生成几个典型组合
    for (let i = 0; i < 5; i++) {
      const parts = { [inputDim || '关键词']: word };
      for (const dim of otherDims) {
        const sorted = Object.entries(dimScores[dim] || {}).sort((a, b) => b[1] - a[1]);
        // 轮询取前几个，避免组合重复
        const pick = sorted[i % Math.max(sorted.length, 1)];
        if (pick) parts[dim] = pick[0];
      }
      if (Object.keys(parts).length >= 2) {
        combos.push({
          word: Object.values(parts).join(' + '),
          parts,
          count: relatedContents.length,
        });
      }
    }

    // 如果词库没命中维度，退化为普通共现热词
    if (combos.length === 0) {
      const { data: allHots } = await supabase.from('hotwords').select('word').limit(200);
      const related = [];
      for (const c of relatedContents) {
        const t = (c.title || '') + ' ' + (c.body || '');
        for (const hw of (allHots || [])) {
          if (hw.word !== word && t.includes(hw.word) && !related.includes(hw.word)) {
            related.push(hw.word);
          }
        }
      }
      return related.slice(0, 10).map(w => ({ word: w, count: relatedContents.length }));
    }

    return combos;
  },

  async refresh() {
    const { data: contents, error } = await supabase.from('contents').select('*');
    if (error) throw new Error(error.message);
    await supabase.from('hotwords').delete().neq('word', '___placeholder___');
    const freq = {};
    const allText = (contents || []).map(c => (c.title || '') + ' ' + (c.body || '').slice(0, 500)).join(' ');
    const stop = new Set(['的','了','是','我','你','他','她','它','们','这','那','在','有','不','和','与','就','都','也','很','要','会','个','说','看','做','去','来','到','什么','怎么','为什么','因为','所以','但是','如果','可以','没有','自己','知道','觉得','一个','这个','那个']);
    const words = allText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(' ').filter(w => w.length >= 2 && w.length <= 8 && !/^\d+$/.test(w) && !stop.has(w));
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 300);
    const rows = entries.map(([word, count]) => ({ word, count }));
    if (rows.length > 0) {
      await supabase.from('hotwords').upsert(rows);
    }
    return { count: rows.length };
  },

  // 手动添加热词
  async add(word) {
    if (!word || !word.trim()) throw new Error('请输入热词');
    const w = word.trim();
    const category = classifyWord(w);
    const { data: existing } = await supabase.from('hotwords').select('count').eq('word', w).single();
    const newCount = (existing?.count || 0) + 1;
    const { error } = await supabase.from('hotwords').upsert({ word: w, count: newCount });
    if (error) throw new Error(error.message);
    return { word: w, count: newCount, category };
  },

  // 批量手动添加
  async addMany(words) {
    const items = words.filter(w => w && w.trim()).map(w => ({
      word: w.trim(),
      count: 1,
    }));
    if (items.length === 0) return { count: 0 };
    const { error } = await supabase.from('hotwords').upsert(items);
    if (error) throw new Error(error.message);
    return { count: items.length };
  },

  // 重新分类所有热词
  async recategorizeAll() {
    const { data: items, error } = await supabase.from('hotwords').select('word');
    if (error) throw new Error(error.message);
    if (!items || items.length === 0) return { count: 0 };
    const updates = items.map(it => ({ word: it.word, category: classifyWord(it.word) }));
    const { error: uErr } = await supabase.from('hotwords').upsert(updates);
    if (uErr) throw new Error(uErr.message);
    return { count: updates.length };
  },

  // 预览分类
  async previewCategory(word) {
    return { word, category: classifyWord(word) };
  },

  async trending() {
    return hotwordAPI.top(10);
  },
};

// ============ Config API ============
export const configAPI = {
  async get() {
    const { data, error } = await supabase.from('config').select('*').eq('key', 'settings').single();
    if (error || !data) {
      return {
        apiKey: '',
        apiType: 'deepseek',
        apiUrl: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-chat',
      };
    }
    const v = data.value || {};
    return {
      apiKey: v.apiKey || '',
      apiType: v.apiType || 'deepseek',
      apiUrl: v.apiUrl || 'https://api.deepseek.com/chat/completions',
      model: v.model || 'deepseek-chat',
    };
  },

  async update(data) {
    const current = await configAPI.get();
    const merged = {
      apiKey: data.apiKey && !data.apiKey.startsWith('***') ? data.apiKey : current.apiKey,
      apiType: data.apiType || current.apiType,
      apiUrl: data.apiUrl || current.apiUrl,
      model: data.model || current.model,
    };
    const { error } = await supabase.from('config').upsert({ key: 'settings', value: merged });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async test() {
    const cfg = await configAPI.get();
    if (!cfg.apiKey) return { ok: false, error: 'API Key 未配置' };
    try {
      const resp = await fetch(cfg.apiUrl || 'https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey,
        },
        body: JSON.stringify({
          model: cfg.model || 'deepseek-chat',
          messages: [{ role: 'user', content: '回复OK' }],
          max_tokens: 5,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().slice(0, 200);
        return { ok: false, error: 'API 错误(' + resp.status + '): ' + txt };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: '网络请求失败: ' + e.message };
    }
  },
};

// ---------- 用户问题库（热门问题排名来源） ----------
// 优先用 Supabase 的 questions 表（跨设备）；表缺失时自动回退 localStorage。
let questionStoreMode = 'unknown'; // 'supabase' | 'local'
const LS_QUESTIONS_KEY = 'ch_questions_v1';

function lsGetQuestions() {
  try { return JSON.parse(localStorage.getItem(LS_QUESTIONS_KEY) || '[]'); }
  catch (e) { return []; }
}
function lsSaveQuestions(arr) {
  localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(arr));
}

export const questionAPI = {
  mode() { return questionStoreMode; },

  async list() {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('ask_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      questionStoreMode = 'supabase';
      return data || [];
    } catch (e) {
      // 表不存在 → 回退本地
      questionStoreMode = 'local';
      return lsGetQuestions()
        .sort((a, b) => (b.ask_count - a.ask_count) || (new Date(b.created_at) - new Date(a.created_at)));
    }
  },

  async create(text, source = '私域') {
    const t = (text || '').trim();
    if (!t) return;
    try {
      const { data, error } = await supabase
        .from('questions')
        .insert({ text: t, source, ask_count: 1 })
        .select()
        .single();
      if (error) throw error;
      questionStoreMode = 'supabase';
      return data;
    } catch (e) {
      questionStoreMode = 'local';
      const arr = lsGetQuestions();
      const item = { id: uid(), text: t, source, ask_count: 1, created_at: new Date().toISOString() };
      arr.push(item);
      lsSaveQuestions(arr);
      return item;
    }
  },

  async increment(id) {
    try {
      if (questionStoreMode === 'local') throw new Error('local');
      const { data: cur, error: rerr } = await supabase
        .from('questions').select('ask_count').eq('id', id).single();
      if (rerr) throw rerr;
      const next = (cur?.ask_count || 0) + 1;
      const { error } = await supabase.from('questions').update({ ask_count: next }).eq('id', id);
      if (error) throw error;
    } catch (e) {
      questionStoreMode = 'local';
      const arr = lsGetQuestions();
      const it = arr.find(q => q.id === id);
      if (it) { it.ask_count = (it.ask_count || 1) + 1; lsSaveQuestions(arr); }
    }
  },

  async remove(id) {
    try {
      if (questionStoreMode === 'local') throw new Error('local');
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      questionStoreMode = 'local';
      const arr = lsGetQuestions().filter(q => q.id !== id);
      lsSaveQuestions(arr);
    }
  },
};

// ---------- 灵感首页每日缓存（按日期，localStorage，避免每天重复烧 AI） ----------
const LS_INSPIRE_KEY = 'ch_inspire_cache_v1';

function lsGetInspire() {
  try { return JSON.parse(localStorage.getItem(LS_INSPIRE_KEY) || '{}'); }
  catch (e) { return {}; }
}

export const inspireAPI = {
  getDaily(dateStr) {
    const all = lsGetInspire();
    return all[dateStr] || null;
  },
  setDaily(dateStr, payload) {
    const all = lsGetInspire();
    all[dateStr] = { ...payload, savedAt: new Date().toISOString() };
    localStorage.setItem(LS_INSPIRE_KEY, JSON.stringify(all));
  },
};

// ---------- 我的灵感收藏（跨设备） ----------
// 优先存 Supabase 的 saved_items 表（跨设备可见）；表缺失时回退 localStorage（当前设备）。
let savedStoreMode = 'unknown'; // 'supabase' | 'local'
const LS_SAVED_KEY = 'ch_saved_v1';

function lsGetSaved() {
  try { return JSON.parse(localStorage.getItem(LS_SAVED_KEY) || '[]'); }
  catch (e) { return []; }
}
function lsSaveSaved(arr) {
  localStorage.setItem(LS_SAVED_KEY, JSON.stringify(arr));
}

export const savedAPI = {
  mode() { return savedStoreMode; },

  async list() {
    try {
      const { data, error } = await supabase
        .from('saved_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      savedStoreMode = 'supabase';
      return data || [];
    } catch (e) {
      savedStoreMode = 'local';
      return lsGetSaved().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async create({ type = 'topic', title = '', body = '', tags = [], meta = {} }) {
    const item = {
      id: uid(),
      type,
      title: title || '',
      body: body || '',
      tags: Array.isArray(tags) ? tags : String(tags || '').split(',').map(s => s.trim()).filter(Boolean),
      meta: meta || {},
      created_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await supabase.from('saved_items').insert(item).select().single();
      if (error) throw error;
      savedStoreMode = 'supabase';
      return data;
    } catch (e) {
      savedStoreMode = 'local';
      const arr = lsGetSaved();
      arr.push(item);
      lsSaveSaved(arr);
      return item;
    }
  },

  async remove(id) {
    try {
      if (savedStoreMode === 'local') throw new Error('local');
      const { error } = await supabase.from('saved_items').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      savedStoreMode = 'local';
      lsSaveSaved(lsGetSaved().filter(s => s.id !== id));
    }
  },
};

// ============ 导出/导入 API ============
export const exportAPI = {
  async exportAll() {
    const { data: contents } = await supabase.from('contents').select('*');
    const { data: decons } = await supabase.from('deconstructions').select('*');
    const { data: rewrites } = await supabase.from('rewrites').select('*');
    const { data: hotwords } = await supabase.from('hotwords').select('*');
    const { data: config } = await supabase.from('config').select('*');
    const exportData = { contents: contents || [], deconstructions: decons || [], rewrites: rewrites || [], hotwords: hotwords || [], config: config || [] };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `内容智库备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  },

  async importAll(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.contents && data.contents.length > 0) {
            await supabase.from('contents').upsert(data.contents);
          }
          if (data.deconstructions && data.deconstructions.length > 0) {
            await supabase.from('deconstructions').upsert(data.deconstructions);
          }
          if (data.rewrites && data.rewrites.length > 0) {
            await supabase.from('rewrites').upsert(data.rewrites);
          }
          if (data.hotwords && data.hotwords.length > 0) {
            await supabase.from('hotwords').upsert(data.hotwords);
          }
          resolve({ ok: true });
        } catch (err) {
          reject(new Error('JSON 格式错误'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },
};

// ========== 热词词性分类 ==========
function classifyWord(word) {
  word = (word || '').toLowerCase();
  const rules = [
    { cat: '人物', words: ['爸爸','妈妈','奶奶','爷爷','孩子','小孩','宝宝','女儿','儿子','姐妹','兄弟','闺蜜','朋友','同事','老板','领导','老师','学生','专家','博主','素人','粉丝','顾客','客户','婆媳','男友','女友','前任','相亲对象','老公','老婆','婆婆','丈母娘','嫂子','大姑姐','亲戚','邻居','陌生人','帅哥','美女','女生','男生','女人','男人','女孩','男孩','大小姐','富婆','打工人','搬砖人','实习生','留学生','宝妈','辣妈','新手妈妈','孕妇','产妇','巨蟹座','天蝎座','双鱼','狮子','射手','摩羯','水瓶','天秤','处女','双子','金牛','白羊'] },
    { cat: '地点', words: ['家','酒店','餐厅','咖啡馆','奶茶店','商场','超市','地铁','公交','机场','火车站','学校','公司','办公室','健身房','医院','理发店','美甲店','电影院','书店','公园','海边','山上','民宿','日本','韩国','上海','北京','深圳','成都','杭州','武汉','南京','西安','长沙','重庆','厦门','三亚','大理','丽江','香港','澳门','自习室','图书馆','展览','寝室','宿舍','出租屋','厨房','卫生间','卧室','客厅','阳台'] },
    { cat: '动词', words: ['学习','工作','加班','出差','面试','入职','离职','辞职','创业','搞钱','赚钱','存钱','花钱','买','卖','送','收','吃','喝','看','听','说','写','拍','做','玩','去','来','回','走','跑','坐','站','躺','睡','醒','逛街','旅行','打卡','探店','拍照','修图','分享','收藏','点赞','评论','转发','私信','关注','取关','表白','分手','和好','吵架','冷战','复合','暗恋','喜欢','爱','讨厌','恨','嫉妒','吃醋','下单','购买','入手','推荐','安利','测评','试用','体验','踩雷','回购','空瓶','囤货'] },
    { cat: '名词', words: ['手机','电脑','苹果','华为','小米','相机','键盘','鼠标','耳机','手表','包','口红','面膜','香水','护肤品','化妆品','精华','面霜','防晒','隔离','粉底','眉笔','眼影','腮红','洗面奶','卸妆','衣服','裤子','裙子','鞋子','袜子','帽子','首饰','项链','戒指','耳环','发型','颜色','好物','神物','宝藏','平替','贵替','大牌','小众','国货','网红款','爆款','奶茶','咖啡','面包','蛋糕','火锅','零食','早饭','午饭','晚饭','宵夜','外卖','菜谱','小红书','抖音','微博','微信','朋友圈','公众号','视频号','电视剧','综艺','vlog','plog','emoji','表情包','音乐','歌曲','短发','长发','卷发','直发','刘海','白色','黑色','红色','粉色','蓝色','绿色'] },
    { cat: '形容词', words: ['好看','漂亮','美','帅','高级','温柔','可爱','性感','高冷','治愈','好吃','难吃','实用','好用','难用','便宜','贵','划算','真香','上头','下头','无语','崩溃','开心','难过','emo','焦虑','迷茫','恐惧','自卑','自信','后悔','满足','幸福','快乐','轻松','沉重','疲惫','精神','兴奋','冷静','淡定','烦躁','离谱','夸张','好笑','有趣','无聊','玄学','神秘','神奇','干净','整洁','温馨','简约','浮夸','土','洋气','时髦','潮流','经典','热门','冷门','小众','精致','粗糙','爆款','恶心','绝','赞','棒','顶','牛','香','甜','咸','辣','淡','浓','清淡','贵妇','平替','平价的','高级的','实用','耐用','顺滑','滋润','服帖','显白','显瘦','显高'] },
    { cat: '语气词', words: ['真的','天哪','绝了','疯了','醉了','救命','笑死','无语死','服了','不得不说','说实话','真心','终于','结果','然后','而且','但是','可是','所以','因为','总之','反正','确实','其实','根本','完全','绝对','一定','必须','千万不要','千万别','求求你','拜托','算了','好啦','好啦好啦','OK','okk','哈哈','嘿嘿','嘻嘻','哦哦','嗯嗯','啊啊','耶','呜','老天爷','我的天','天啊','我的妈','笑死我了','哈哈哈','呵呵','我去','我去'] },
  ];
  let bestCat = '名词';
  let bestScore = 0;
  for (const rule of rules) {
    let score = 0;
    for (const w of rule.words) {
      if (word.includes(w) || w.includes(word)) score += 2;
      if (word === w) score += 5;
    }
    if (score > bestScore) { bestScore = score; bestCat = rule.cat; }
  }
  return bestCat;
}

// ============ 辅助函数 ============
function autoClassify(text) {
  const rules = [
    { cat: '占星', words: ['星座', '星盘', '上升', '太阳', '月亮', '金星', '火星', '水星', '木星', '土星', '冥王', '海王', '天王', '宫位', '相位', '合相', '水瓶', '射手', '处女', '天蝎', '双子', '白羊', '金牛', '巨蟹', '狮子', '天秤', '摩羯', '双鱼', '本命', '逆行', '水逆'] },
    { cat: '玄学', words: ['八字', '命理', '运势', '流年', '风水', '塔罗', '占卜', '五行', '命盘', '紫微', '算命', '能量', '玄学', '磁场', '转运', '桃花', '姻缘'] },
    { cat: '穿搭', words: ['穿搭', '搭配', 'ootd', 'look', '显瘦', '显高', '配色', 'ootw', '穿衣', '时尚', '单品', '卫衣', '衬衫', '裙子', '裤子', '外套', '西装', '毛衣', '风格', '小个子', '微胖', '梨形', '肩宽', '腰线', '显气质', 'ins风', '法式', '韩系', '日系', '甜妹', '辣妹', '氛围感', '高级感', '通勤', '约会穿搭', '私服'] },
    { cat: '生活干货', words: ['小技巧', '生活妙招', '收纳', '清洁', '省钱', '攻略', '教程', '步骤', '怎么做', '干货', '实用', '方法', '误区', '经验', '分享', '好用', '神器', '妙招', '窍门', '生活小'] },
    { cat: '自媒体运营', words: ['涨粉', '自媒体', '运营', '小红书运营', '抖音运营', '爆款', '流量', '选题', '账号', '笔记', '起号', '素人', '博主', '数据', '女工', '薯条', '投流', '引流', '变现', '内容创业', '做号'] },
    { cat: '赚钱', words: ['搞钱', '赚钱', '副业', '理财', '投资', '基金', '存款', '收入', '财富', '变现', '存钱', '开源', '节流', '兼职', '增收', '被动收入', '睡后收入'] },
    { cat: '带货', words: ['带货', '直播', '电商', '开店', '淘宝', '拼多多', '抖音电商', '选品', '出单', '橱窗', '挂车', '好物推荐', '种草', '安利'] },
    { cat: '变美', words: ['护肤', '化妆', '变美', '美容', '瘦身', '减肥', '健身', '医美', '发型', '美甲', '化妆教程', '眼影', '口红', '粉底', '面膜', '精华', '面霜', '水乳', '防晒', '抗老', '美白', '祛斑', '祛痘', '黑头', '毛孔', '敏感肌', '油皮', '干皮', '混油皮', '痘肌', '护肤步骤', '妆容', '卧蚕', '高光', '腮红', '眉笔', '眼线'] },
    { cat: '养生', words: ['养生', '中医', '健康', '食疗', '补气血', '祛湿', '泡脚', '脾胃', '调理', '三伏天', '冬病夏治', '针灸', '拔罐', '艾灸', '推拿', '食补', '养颜', '养发', '生发', '睡眠', '失眠'] },
    { cat: '职场', words: ['职场', '工作', '面试', '升职', '加薪', '跳槽', '同事', '领导', '创业', '效率', '汇报', 'PPT', 'offer', '简历', '入职', '离职', '转正', '考公', '编制', '开会', '团建'] },
    { cat: '情感', words: ['情感', '恋爱', '男朋友', '女朋友', '分手', '复合', '暧昧', '相亲', '婚姻', '前任', '脱单', '恋爱脑', '舔狗', 'PUA', '冷暴力', '出轨', '家暴', '冷战', '吵架', '和好', '表白', '拒绝', '好感', '喜欢', '暗恋', '已读不回', '送礼物', '纪念日', '七夕', '情人节'] },
    { cat: '家居生活', words: ['家居', '装修', '租房', '收纳', '家具', '改造', '好物', '布置', '软装', '卧室', '客厅', '厨房', '卫生间', '阳台', '出租屋', '小户型', 'ins家居', '日式', '北欧', '极简', '奶油风', '原木风', '搬家', '入住', '买家具', '床品', '枕头', '被子', '窗帘', '香薰', '氛围灯', '摆件'] },
    { cat: '母婴', words: ['宝宝', '带娃', '育儿', '母婴', '孕妈', '孕妇', '新生儿', '婴儿', '幼儿', '早教', '辅食', '奶粉', '尿不湿', '纸尿裤', '奶瓶', '推车', '婴儿车', '待产包', '坐月子', '产后', '哺乳', '断奶', '幼儿园', '小学', '辅导', '作业', '儿童'] },
    { cat: '美食', words: ['美食', '食谱', '菜谱', '做法', '家常菜', '烘焙', '甜品', '蛋糕', '面包', '奶茶', '咖啡', '饮品', '减脂餐', '低卡', '轻食', '早餐', '午餐', '晚餐', '夜宵', '下饭菜', '懒人食谱', '快手菜', '空气炸锅', '电饭煲', '面包机', '甜汤', '糖水', '甜品店', '探店', '下午茶', '卡路里', '热量'] },
    { cat: '好物', words: ['好物', '推荐', '测评', '体验', '分享', '使用', '回购', '种草', '拔草', '开箱', '试过', '真香', '不踩雷', '必入', '囤货', '无限回购', '自用', '无广', '良心', '推荐好物'] },
    { cat: '旅行', words: ['旅行', '旅游', '攻略', '打卡', '探店', '酒店', '民宿', '机票', '高铁', '自驾', '路线', '景点', '周末游', '周边游', '度假', '海岛', '出国', '签证', '日韩', '东南亚', '欧洲', '自由行', '跟团', '穷游', 'citywalk'] },
    { cat: '学习', words: ['学习', '读书', '考研', '考公', '考证', '英语', '雅思', '托福', '四六级', '教师资格证', 'CPA', '法考', '注会', '留学', 'GRE', 'GMAT', '笔记', '学习方法', '时间管理', '自律', '专注', '番茄钟', '习惯养成', '复盘'] },
  ];
  text = (text || '').toLowerCase();
  let bestCat = '未分类';
  let bestScore = 0;
  for (const rule of rules) {
    let score = 0;
    for (const w of rule.words) {
      if (text.includes(w.toLowerCase())) score++;
    }
    if (score > bestScore) { bestScore = score; bestCat = rule.cat; }
  }
  return bestCat;
}

function detectTitlePattern(title) {
  if (/\d+[个条种]/.test(title)) return '数字列举型';
  if (/吗[？?]/.test(title) || /怎么|如何|为什么/.test(title)) return '疑问引导型';
  if (/！|!/.test(title)) return '情绪感叹型';
  if (/「|」|【|】/.test(title)) return '标签分类型';
  return '陈述直给型';
}

function extractKeywords(text, n = 3) {
  const stop = new Set(['的', '了', '是', '我', '你', '他', '她', '它', '们', '这', '那', '在', '有', '不', '和', '与', '就', '都', '也', '很', '要', '会', '个', '说', '看', '做', '去', '来', '到']);
  const words = (text || '').replace(/[，。！？、；：""''【】（）\s,.!?;:'"\[\]()]/g, ' ').split(' ').filter(w => w.length >= 2 && !stop.has(w));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
}

async function extractHotwordsFromItem(item) {
  const text = (item.title || '') + ' ' + (item.body || '').slice(0, 500);
  const stop = new Set(['的','了','是','我','你','他','她','它','们','这','那','在','有','不','和','与','就','都','也','很','要','会','个','说','看','做','去','来','到','什么','怎么','为什么','因为','所以','但是','如果','可以','没有','自己','知道','觉得','一个','这个','那个']);
  const words = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(' ').filter(w => w.length >= 2 && w.length <= 8 && !/^\d+$/.test(w) && !stop.has(w));
  const upserts = words.map(w => ({ word: w, count: 1 }));
  if (upserts.length > 0) {
    const { data: existing } = await supabase.from('hotwords').select('word, count').in('word', [...new Set(words)]);
    const existingMap = {};
    (existing || []).forEach(h => { existingMap[h.word] = h.count; });
    const toUpsert = [];
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    for (const [word, count] of Object.entries(freq)) {
      toUpsert.push({ word, count: (existingMap[word] || 0) + count });
    }
    if (toUpsert.length > 0) {
      await supabase.from('hotwords').upsert(toUpsert);
    }
  }
}

// ========== 抖音文案提取格式化 ==========
const SENSITIVE_WORDS = [
  '最', '第一', '全网', '唯一', '绝对', '永久', '根治', '包治', '特效',
  '保证', '无效退款', '零风险', '100%', '国家级', '最高级', '顶级',
  '第一品牌', '独一无二', '万能', '纯天然', '无添加', '首选',
  '不买后悔', '买到就是赚到', '错过等一年',
];

function checkSensitive(text) {
  const found = SENSITIVE_WORDS.filter(w => text.includes(w));
  return found.length > 0 ? found : null;
}

function formatDouyinExtract(data) {
  const t = data.title || '';
  const rawText = data.text || '';
  const tags = data.tags || [];
  const author = data.author || '';
  const charCount = data.charCount || rawText.replace(/[\s\n]/g, '').length;
  const sec = data.estimatedSec || Math.round(charCount / 4);
  
  const sensitive = checkSensitive(rawText + t);
  
  // 精简浓缩版：取前120字 + 关键标签
  const condensed = rawText
    .replace(/\s+/g, ' ').trim()
    .slice(0, 150)
    .replace(/。[^。]*$/, '。');
  
  // 优化朗读版：按句号分段，每句一行
  const optimized = rawText
    .replace(/[。！？；]/g, '$&\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/,/g, '，')
    .trim();
  
  let output = '【标题】\n' + t + '\n\n';
  
  if (author) output += '【作者】\n' + author + '\n\n';
  
  if (tags.length > 0) output += '【标签】\n' + tags.join(' ') + '\n\n';
  
  output += '【口播文案 · 原版提取】\n' + (rawText || '未提取到文案') + '\n\n';
  
  output += '【违禁 / 敏感词提醒】\n';
  if (sensitive) {
    output += '⚠️ 检测到以下敏感/极限词：' + sensitive.join('、') + '\n';
    output += '建议在发布前替换为更温和的表达。\n';
  } else {
    output += '✅ 未检测到明显违禁/敏感词汇\n';
  }
  output += '备注：本提醒为通用合规参考，不代表任何平台官方审核意见。\n\n';
  
  output += '【口播文案 · 优化朗读版】\n' + (optimized || rawText) + '\n\n';
  
  output += '【口播文案 · 精简浓缩版】\n' + (condensed || rawText.slice(0, 150)) + '\n\n';
  
  output += '【文案时长参考】\n';
  output += '总字数：' + charCount + ' 字\n';
  output += '建议口播时长：约 ' + sec + ' 秒\n';
  
  return output;
}
