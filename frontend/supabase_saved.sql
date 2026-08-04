-- ============================================================
--  我的灵感收藏表（saved_items）
--  用途：灵感首页选题 / 玄学技能结果 一键收藏，跨设备可见
--  执行位置：Supabase 控制台 → SQL Editor → 粘贴运行
--  说明：与 questions 表同样开放 anon 读写（前端 publishable key 直连）
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_items (
  id          TEXT PRIMARY KEY,
  type        TEXT DEFAULT 'topic',          -- topic=选题 / skill=玄学生成
  title       TEXT DEFAULT '',
  body        TEXT DEFAULT '',
  tags        TEXT[] DEFAULT '{}',
  meta        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 索引：按时间倒序读取
CREATE INDEX IF NOT EXISTS idx_saved_items_created_at ON saved_items (created_at DESC);

-- 开启行级安全
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

-- 匿名（前端 publishable key）可读写，便于任意设备打开同一链接看到同一份收藏
DROP POLICY IF EXISTS "anon read saved_items" ON saved_items;
CREATE POLICY "anon read saved_items" ON saved_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon insert saved_items" ON saved_items;
CREATE POLICY "anon insert saved_items" ON saved_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete saved_items" ON saved_items;
CREATE POLICY "anon delete saved_items" ON saved_items FOR DELETE USING (true);
