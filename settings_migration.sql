-- Настройки аккаунта и приватность для «Смотрю».
-- Выполнить один раз в Supabase SQL Editor.

-- Публичные параметры приватности автора: они нужны клиенту, чтобы
-- корректно скрывать контент/действия для других пользователей.
alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists hide_likes boolean not null default false;
alter table public.profiles add column if not exists who_can_comment text not null default 'all';
alter table public.profiles add column if not exists who_can_message text not null default 'all';
alter table public.profiles add column if not exists who_can_duet text not null default 'all';
alter table public.profiles add column if not exists allow_downloads boolean not null default true;

-- Единая таблица персональных настроек.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark',
  language text not null default 'ru',
  autoplay boolean not null default true,
  data_saver boolean not null default false,
  video_quality text not null default 'auto',
  private_account boolean not null default false,
  who_can_comment text not null default 'all',
  who_can_message text not null default 'all',
  who_can_duet text not null default 'all',
  hide_likes boolean not null default false,
  allow_downloads boolean not null default true,
  push_enabled boolean not null default false,
  notify_likes boolean not null default true,
  notify_comments boolean not null default true,
  notify_follows boolean not null default true,
  notify_mentions boolean not null default true,
  notify_reposts boolean not null default true,
  notify_messages boolean not null default true,
  notify_donations boolean not null default true,
  email_notifications boolean not null default true,
  dnd_from text not null default '',
  dnd_to text not null default '',
  content_filter_level integer not null default 0,
  screen_time_limit integer not null default 0,
  break_reminder boolean not null default false,
  hidden_words jsonb not null default '[]'::jsonb,
  comment_moderation_enabled boolean not null default true,
  comment_moderation_level integer not null default 2,
  updated_at timestamptz not null default now()
);

alter table public.user_settings add column if not exists theme text not null default 'dark';
alter table public.user_settings add column if not exists language text not null default 'ru';
alter table public.user_settings add column if not exists autoplay boolean not null default true;
alter table public.user_settings add column if not exists data_saver boolean not null default false;
alter table public.user_settings add column if not exists video_quality text not null default 'auto';
alter table public.user_settings add column if not exists private_account boolean not null default false;
alter table public.user_settings add column if not exists who_can_comment text not null default 'all';
alter table public.user_settings add column if not exists who_can_message text not null default 'all';
alter table public.user_settings add column if not exists who_can_duet text not null default 'all';
alter table public.user_settings add column if not exists hide_likes boolean not null default false;
alter table public.user_settings add column if not exists allow_downloads boolean not null default true;
alter table public.user_settings add column if not exists push_enabled boolean not null default false;
alter table public.user_settings add column if not exists notify_likes boolean not null default true;
alter table public.user_settings add column if not exists notify_comments boolean not null default true;
alter table public.user_settings add column if not exists notify_follows boolean not null default true;
alter table public.user_settings add column if not exists notify_mentions boolean not null default true;
alter table public.user_settings add column if not exists notify_reposts boolean not null default true;
alter table public.user_settings add column if not exists notify_messages boolean not null default true;
alter table public.user_settings add column if not exists notify_donations boolean not null default true;
alter table public.user_settings add column if not exists email_notifications boolean not null default true;
alter table public.user_settings add column if not exists dnd_from text not null default '';
alter table public.user_settings add column if not exists dnd_to text not null default '';
alter table public.user_settings add column if not exists content_filter_level integer not null default 0;
alter table public.user_settings add column if not exists screen_time_limit integer not null default 0;
alter table public.user_settings add column if not exists break_reminder boolean not null default false;
alter table public.user_settings add column if not exists hidden_words jsonb not null default '[]'::jsonb;
alter table public.user_settings add column if not exists comment_moderation_enabled boolean not null default true;
alter table public.user_settings add column if not exists comment_moderation_level integer not null default 2;
alter table public.user_settings add column if not exists updated_at timestamptz not null default now();

alter table public.user_settings enable row level security;
drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings for select to authenticated using (user_id = auth.uid());
drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_settings_delete_own on public.user_settings;
create policy user_settings_delete_own on public.user_settings for delete to authenticated using (user_id = auth.uid());

-- Синхронизируем старые значения профиля в настройки при первом запуске.
insert into public.user_settings (user_id, private_account, hide_likes, who_can_comment, who_can_message, who_can_duet, allow_downloads)
select p.id,
       coalesce(p.is_private,false),
       coalesce(p.hide_likes,false),
       coalesce(p.who_can_comment,'all'),
       coalesce(p.who_can_message,'all'),
       coalesce(p.who_can_duet,'all'),
       coalesce(p.allow_downloads,true)
from public.profiles p
on conflict (user_id) do update set
  private_account = excluded.private_account,
  hide_likes = excluded.hide_likes,
  who_can_comment = excluded.who_can_comment,
  who_can_message = excluded.who_can_message,
  who_can_duet = excluded.who_can_duet,
  allow_downloads = excluded.allow_downloads,
  updated_at = now();

-- Заявки на подписку для приватных аккаунтов.
create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id,target_id)
);
create index if not exists follow_requests_target_status_idx on public.follow_requests(target_id,status,created_at desc);
create index if not exists follow_requests_requester_status_idx on public.follow_requests(requester_id,status,created_at desc);

alter table public.follow_requests enable row level security;
drop policy if exists follow_requests_select_own_or_target on public.follow_requests;
create policy follow_requests_select_own_or_target on public.follow_requests
for select to authenticated using (requester_id = auth.uid() or target_id = auth.uid());
drop policy if exists follow_requests_insert_own on public.follow_requests;
create policy follow_requests_insert_own on public.follow_requests
for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists follow_requests_update_target on public.follow_requests;
create policy follow_requests_update_target on public.follow_requests
for update to authenticated using (target_id = auth.uid()) with check (target_id = auth.uid());
drop policy if exists follow_requests_delete_own on public.follow_requests;
create policy follow_requests_delete_own on public.follow_requests
for delete to authenticated using (requester_id = auth.uid() or target_id = auth.uid());


-- Безопасное принятие заявки: владелец приватного аккаунта может создать
-- подписку от имени заявителя только для конкретной pending-заявки.
create or replace function public.accept_follow_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.follow_requests%rowtype;
begin
  select * into r
  from public.follow_requests
  where id = p_request_id
    and target_id = auth.uid()
    and status = 'pending'
  for update;

  if not found then
    raise exception using errcode='P0001', message='FOLLOW_REQUEST_NOT_FOUND';
  end if;

  insert into public.subscriptions (follower_id, following_id)
  values (r.requester_id, r.target_id)
  on conflict (follower_id, following_id) do nothing;

  update public.follow_requests
  set status='accepted', updated_at=now()
  where id=r.id;

  return true;
end;
$$;

revoke all on function public.accept_follow_request(uuid) from public;
grant execute on function public.accept_follow_request(uuid) to authenticated;
