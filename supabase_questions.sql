-- ============================================================
--  爆款内容智库 · 用户问题库（热门问题排名数据源）
--  在 Supabase 后台 → SQL Editor 中执行本文件即可
--  执行后「灵感首页 → 热门问题排名」即启用跨设备持久化
-- ============================================================

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  source      text default '私域',
  ask_count   integer default 1,
  created_at  timestamptz default now()
);

-- 启用行级安全（与其他表一致）
alter table public.questions enable row level security;

-- 匿名（前端 anon key）可读写删：与现有 contents / hotwords 等表策略保持一致
drop policy if exists "questions_anon_select" on public.questions;
create policy "questions_anon_select" on public.questions
  for select using (true);

drop policy if exists "questions_anon_insert" on public.questions;
create policy "questions_anon_insert" on public.questions
  for insert with check (true);

drop policy if exists "questions_anon_update" on public.questions;
create policy "questions_anon_update" on public.questions
  for update using (true);

drop policy if exists "questions_anon_delete" on public.questions;
create policy "questions_anon_delete" on public.questions
  for delete using (true);

-- 可选：建索引，问题量大时排序更快
create index if not exists questions_ask_count_idx on public.questions (ask_count desc);

-- 首次使用可先灌几条示例问题（按需保留/删除）：
-- insert into public.questions (text, source, ask_count) values
--   ('最近总失眠，是不是水逆影响？', '私域', 12),
--   ('上升星座和太阳星座到底看哪个？', '评论', 9),
--   ('土星落陷怎么化解？', '直播', 6);
