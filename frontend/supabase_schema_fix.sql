-- ============================================================
-- 爆款内容智库：Supabase 表结构修复脚本
-- 用途：补齐 deconstructions / rewrites 表在后续迭代中新增但未创建的列
-- 执行方式：登录 Supabase → SQL Editor → New query → 全选粘贴 → Run
-- 注意：使用 IF NOT EXISTS，可重复执行，不会删除已有数据
-- ============================================================

-- ----------------------
-- 1. 拆解表 deconstructions
-- ----------------------
ALTER TABLE IF EXISTS deconstructions
  ADD COLUMN IF NOT EXISTS title_pattern TEXT,
  ADD COLUMN IF NOT EXISTS hook TEXT,
  ADD COLUMN IF NOT EXISTS emotion_curve TEXT,
  ADD COLUMN IF NOT EXISTS interaction TEXT,
  ADD COLUMN IF NOT EXISTS ending TEXT,
  ADD COLUMN IF NOT EXISTS key_elements JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS structure TEXT,
  ADD COLUMN IF NOT EXISTS gene_reasons JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reusable_genes JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS golden_sentences JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS score INT DEFAULT 80,
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ DEFAULT NOW();

-- 如果 content_id 不是主键，建议补唯一约束（避免 upsert 冲突）
-- DO $$ BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_indexes WHERE indexname = 'deconstructions_content_id_key'
--   ) THEN
--     ALTER TABLE deconstructions ADD CONSTRAINT deconstructions_content_id_key UNIQUE (content_id);
--   END IF;
-- END $$;

-- ----------------------
-- 2. 仿写表 rewrites
-- ----------------------
ALTER TABLE IF EXISTS rewrites
  ADD COLUMN IF NOT EXISTS content_id UUID,
  ADD COLUMN IF NOT EXISTS brief TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS style TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;

-- ----------------------
-- 3. 内容表 contents（常见缺失字段，顺手补齐）
-- ----------------------
ALTER TABLE IF EXISTS contents
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '未分类',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ----------------------
-- 4. 启用 RLS（若尚未开启）并给 anon 用户开放读写
-- ----------------------
ALTER TABLE IF EXISTS deconstructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rewrites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contents ENABLE ROW LEVEL SECURITY;

-- 清理旧策略（避免重复创建报错）
DROP POLICY IF EXISTS anon_deconstructions_all ON deconstructions;
DROP POLICY IF EXISTS anon_rewrites_all ON rewrites;
DROP POLICY IF EXISTS anon_contents_all ON contents;

CREATE POLICY anon_deconstructions_all ON deconstructions
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY anon_rewrites_all ON rewrites
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY anon_contents_all ON contents
  FOR ALL TO anon USING (true) WITH CHECK (true);
