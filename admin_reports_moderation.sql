-- Admin reports section: video/comment complaint moderation.
-- Applied to Supabase project xzaryhtrzdjrrqgrowkv.

alter table public.comment_reports
  add column if not exists status text not null default 'open',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_note text not null default '';

alter table public.video_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_note text not null default '';

alter table public.comment_reports
  drop constraint if exists comment_reports_status_check;
alter table public.comment_reports
  add constraint comment_reports_status_check check (status in ('open','reviewed','dismissed','actioned'));

alter table public.video_reports
  drop constraint if exists video_reports_status_check;
alter table public.video_reports
  add constraint video_reports_status_check check (status in ('open','reviewed','dismissed','actioned'));

create index if not exists comment_reports_status_created_idx on public.comment_reports(status, created_at desc);
create index if not exists video_reports_status_created_idx on public.video_reports(status, created_at desc);

drop policy if exists comment_reports_admin_select on public.comment_reports;
create policy comment_reports_admin_select on public.comment_reports for select to authenticated using (public.is_platform_admin());
drop policy if exists comment_reports_admin_update on public.comment_reports;
create policy comment_reports_admin_update on public.comment_reports for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists video_reports_admin_select on public.video_reports;
create policy video_reports_admin_select on public.video_reports for select to authenticated using (public.is_platform_admin());
drop policy if exists video_reports_admin_update on public.video_reports;
create policy video_reports_admin_update on public.video_reports for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists smotryu_admin_videos_read on public.videos;
create policy smotryu_admin_videos_read on public.videos for select to authenticated using (public.is_platform_admin());
