-- ============================================================
-- 爆款内容智库：完整 Supabase 建表脚本（新建项目时用）
-- 已包含当前代码所需全部字段
-- ============================================================

-- 内容库
CREATE TABLE IF NOT EXISTS contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body TEXT,
  url TEXT,
  platform TEXT,
  category TEXT DEFAULT '未分类',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 拆解结果
CREATE TABLE IF NOT EXISTS deconstructions (
  content_id UUID PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
  title_pattern TEXT,
  hook TEXT,
  emotion_curve TEXT,
  interaction TEXT,
  ending TEXT,
  key_elements JSONB DEFAULT '[]',
  structure TEXT,
  gene_reasons JSONB DEFAULT '{}',
  reusable_genes JSONB DEFAULT '[]',
  golden_sentences JSONB DEFAULT '[]',
  score INT DEFAULT 80,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 仿写结果
CREATE TABLE IF NOT EXISTS rewrites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
  brief TEXT,
  title TEXT,
  body TEXT,
  style TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  starred BOOLEAN DEFAULT FALSE
);

-- 热词库
CREATE TABLE IF NOT EXISTS hotwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  category TEXT,
  weight INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 配置表
CREATE TABLE IF NOT EXISTS config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 收藏（我的灵感）
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deconstructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_contents_all ON contents;
DROP POLICY IF EXISTS anon_deconstructions_all ON deconstructions;
DROP POLICY IF EXISTS anon_rewrites_all ON rewrites;
DROP POLICY IF EXISTS anon_hotwords_all ON hotwords;
DROP POLICY IF EXISTS anon_config_all ON config;
DROP POLICY IF EXISTS anon_saved_items_all ON saved_items;

CREATE POLICY anon_contents_all ON contents FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_deconstructions_all ON deconstructions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_rewrites_all ON rewrites FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_hotwords_all ON hotwords FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_config_all ON config FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_saved_items_all ON saved_items FOR ALL TO anon USING (true) WITH CHECK (true);
