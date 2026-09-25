-- «Смотрю» — UGC safety migration for comment reports and user blocks.
-- Run once in the project database before publishing a build that uses remote moderation tables.

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'other',
  details text not null default '',
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create index if not exists idx_comment_reports_comment on public.comment_reports(comment_id);
create index if not exists idx_comment_reports_created_at on public.comment_reports(created_at desc);

alter table public.comment_reports enable row level security;

drop policy if exists comment_reports_insert_own on public.comment_reports;
create policy comment_reports_insert_own
on public.comment_reports for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists comment_reports_select_own on public.comment_reports;
create policy comment_reports_select_own
on public.comment_reports for select
to authenticated
using (reporter_id = auth.uid());

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_user_blocks_blocker on public.user_blocks(blocker_id);
create index if not exists idx_user_blocks_blocked on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own
on public.user_blocks for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own
on public.user_blocks for insert
to authenticated
with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own
on public.user_blocks for delete
to authenticated
using (blocker_id = auth.uid());
