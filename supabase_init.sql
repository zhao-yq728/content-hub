-- ============================================================
--  爆款内容智库 - Supabase 数据库初始化 SQL
--  在 Supabase Dashboard → SQL Editor 中粘贴运行
-- ============================================================

-- 1. 内容表
CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  url TEXT DEFAULT '',
  platform TEXT DEFAULT 'other',
  category TEXT DEFAULT '未分类',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 拆解表
CREATE TABLE IF NOT EXISTS deconstructions (
  content_id TEXT PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
  title_pattern TEXT DEFAULT '',
  hook TEXT DEFAULT '',
  emotion_curve TEXT DEFAULT '',
  interaction TEXT DEFAULT '',
  ending TEXT DEFAULT '',
  key_elements JSONB DEFAULT '[]',
  structure TEXT DEFAULT '',
  reusable_genes JSONB DEFAULT '[]',
  golden_sentences JSONB DEFAULT '[]',
  score INTEGER DEFAULT 80,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为旧版数据库补齐新字段（安全可重复执行）
ALTER TABLE deconstructions ADD COLUMN IF NOT EXISTS reusable_genes JSONB DEFAULT '[]';
ALTER TABLE deconstructions ADD COLUMN IF NOT EXISTS golden_sentences JSONB DEFAULT '[]';
ALTER TABLE deconstructions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 80;

-- 3. 仿写表
CREATE TABLE IF NOT EXISTS rewrites (
  id TEXT PRIMARY KEY,
  content_id TEXT,
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  style TEXT DEFAULT 'parody',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  starred BOOLEAN DEFAULT FALSE
);

-- 4. 热词表
CREATE TABLE IF NOT EXISTS hotwords (
  word TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  category TEXT DEFAULT '通用',
  source TEXT DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为旧版数据库补齐新字段
ALTER TABLE hotwords ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '通用';
ALTER TABLE hotwords ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'auto';
ALTER TABLE hotwords ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 5. 配置表（存 API Key 等）
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}'
);

-- ============================================================
--  启用行级安全 (RLS) + 允许公开访问
-- ============================================================

ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deconstructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- 允许所有人读写（公开内容库）
CREATE POLICY "public_read_contents" ON contents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_write_contents" ON contents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_read_deconstructions" ON deconstructions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_write_deconstructions" ON deconstructions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_read_rewrites" ON rewrites FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_write_rewrites" ON rewrites FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_read_hotwords" ON hotwords FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_write_hotwords" ON hotwords FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_read_config" ON config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_write_config" ON config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
--  插入默认配置
-- ============================================================
INSERT INTO config (key, value) VALUES ('settings', '{"apiType":"deepseek","apiUrl":"https://api.deepseek.com/chat/completions","model":"deepseek-chat"}')
ON CONFLICT (key) DO NOTHING;
