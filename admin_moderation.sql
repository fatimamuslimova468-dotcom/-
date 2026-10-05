-- «Смотрю» — административная модерация.
-- В панели нет отдельной формы логина/пароля: используется уже активная
-- Supabase-сессия пользователя, которому вы один раз выдали роль администратора.
--
-- После применения миграции добавьте UUID администратора:
-- insert into public.platform_admins(user_id) values ('UUID_АДМИНИСТРАТОРА')
-- on conflict (user_id) do nothing;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists platform_admins_select_own on public.platform_admins;
create policy platform_admins_select_own
on public.platform_admins
for select
to authenticated
using (user_id = (select auth.uid()));

grant select on public.platform_admins to authenticated;

alter table public.videos
  add column if not exists moderation_blocked boolean not null default false,
  add column if not exists moderation_reason text not null default '',
  add column if not exists moderation_blocked_at timestamptz,
  add column if not exists moderation_blocked_by uuid references auth.users(id) on delete set null;

alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists ban_reason text not null default '',
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid references auth.users(id) on delete set null;

create index if not exists idx_videos_moderation_blocked
  on public.videos(moderation_blocked, created_at desc);

create index if not exists idx_profiles_is_banned
  on public.profiles(is_banned, updated_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists smotryu_admin_videos_update on public.videos;
create policy smotryu_admin_videos_update
on public.videos
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists smotryu_admin_comments_delete on public.comments;
create policy smotryu_admin_comments_delete
on public.comments
for delete
to authenticated
using (public.is_platform_admin());

drop policy if exists smotryu_admin_profiles_update on public.profiles;
create policy smotryu_admin_profiles_update
on public.profiles
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
