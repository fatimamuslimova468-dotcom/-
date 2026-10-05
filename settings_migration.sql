-- Настройки аккаунта и приватность для «Смотрю».
-- Выполнить один раз в Supabase SQL Editor.

-- Публичные параметры приватности автора: они нужны клиенту, чтобы
-- корректно скрывать контент/действия для других пользователей.
alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists hide_likes boolean not null default false;

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
insert into public.user_settings (user_id, private_account, hide_likes)
select p.id, coalesce(p.is_private,false), coalesce(p.hide_likes,false)
from public.profiles p
on conflict (user_id) do update set
  private_account = excluded.private_account,
  hide_likes = excluded.hide_likes,
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


-- ============================================================
-- Кликабельные уведомления и единое уведомление о комментариях
-- ============================================================
alter table public.notifications
  add column if not exists video_id uuid references public.videos(id) on delete set null,
  add column if not exists comment_id uuid references public.comments(id) on delete set null,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists message_id uuid references public.messages(id) on delete set null;

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_source_video_idx on public.notifications(video_id, comment_id);

create or replace function public.create_notification(p_user_id uuid, p_type text, p_actor_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  body text := coalesce(p_payload->>'text', p_type);
  v_video_id uuid := nullif(p_payload->>'video_id','')::uuid;
  v_comment_id uuid := nullif(p_payload->>'comment_id','')::uuid;
  v_conversation_id uuid := nullif(p_payload->>'conversation_id','')::uuid;
  v_message_id uuid := nullif(p_payload->>'message_id','')::uuid;
begin
  if p_user_id is null or p_actor_id = p_user_id then return; end if;
  insert into public.notifications(user_id, actor_id, type, text, video_id, comment_id, conversation_id, message_id, payload, is_read)
  values(p_user_id, p_actor_id, p_type, body, v_video_id, v_comment_id, v_conversation_id, v_message_id, coalesce(p_payload, '{}'::jsonb), false);
end;
$$;
revoke all on function public.create_notification(uuid,text,uuid,jsonb) from public;

-- Один триггер на комментарий: без дублей и сразу с video_id/comment_id для навигации.
drop trigger if exists comments_notification on public.comments;
drop trigger if exists comment_notification on public.comments;

create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  creator uuid;
  actor_name text;
  comment_preview text;
  parent_author uuid;
begin
  select user_id into creator from public.videos where id = new.video_id;
  select coalesce(display_name,name,'Пользователь') into actor_name from public.profiles where id = new.user_id;
  comment_preview := left(regexp_replace(coalesce(new.text,new.content,''), '\s+', ' ', 'g'), 90);
  if creator is not null and creator <> new.user_id then
    perform public.create_notification(creator,'comment',new.user_id,jsonb_build_object(
      'video_id',new.video_id,'comment_id',new.id,
      'text',actor_name || ' прокомментировал(а) твоё видео' || case when comment_preview<>'' then ': '||comment_preview else '' end));
  end if;
  if new.parent_id is not null then
    select user_id into parent_author from public.comments where id=new.parent_id;
    if parent_author is not null and parent_author <> new.user_id and parent_author <> creator then
      perform public.create_notification(parent_author,'comment',new.user_id,jsonb_build_object(
        'video_id',new.video_id,'comment_id',new.id,
        'text',actor_name || ' ответил(а) на твой комментарий' || case when comment_preview<>'' then ': '||comment_preview else '' end));
    end if;
  end if;
  return new;
end;
$$;
create trigger comment_notification after insert on public.comments for each row execute function public.notify_comment();


-- Связать системные email/push-предпочтения с настройками «Смотрю».
alter table public.notification_preferences enable row level security;
drop policy if exists pref_insert_own on public.notification_preferences;
create policy pref_insert_own on public.notification_preferences
for insert to authenticated with check ((select auth.uid()) = user_id);

-- Старые уведомления получают источник из payload, но только если объект ещё существует.
update public.notifications n
set video_id = (select v.id from public.videos v where v.id = nullif(n.payload->>'video_id','')::uuid)
where n.video_id is null
  and n.payload ? 'video_id'
  and (n.payload->>'video_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

update public.notifications n
set comment_id = (select c.id from public.comments c where c.id = nullif(n.payload->>'comment_id','')::uuid)
where n.comment_id is null
  and n.payload ? 'comment_id'
  and (n.payload->>'comment_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

update public.notifications n
set conversation_id = (select cv.id from public.conversations cv where cv.id = nullif(n.payload->>'conversation_id','')::uuid)
where n.conversation_id is null
  and n.payload ? 'conversation_id'
  and (n.payload->>'conversation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

update public.notifications n
set message_id = (select m.id from public.messages m where m.id = nullif(n.payload->>'message_id','')::uuid)
where n.message_id is null
  and n.payload ? 'message_id'
  and (n.payload->>'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';


-- Safe public interaction settings endpoint used by the client for other profiles.
create or replace function public.get_public_profile_settings(p_user_ids uuid[])
returns table(
  user_id uuid,
  who_can_comment text,
  who_can_message text,
  who_can_duet text,
  allow_downloads boolean
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    us.user_id,
    coalesce(us.who_can_comment,'all'),
    coalesce(us.who_can_message,'all'),
    coalesce(us.who_can_duet,'all'),
    coalesce(us.allow_downloads,true)
  from public.user_settings us
  where us.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
$$;
revoke all on function public.get_public_profile_settings(uuid[]) from public;
grant execute on function public.get_public_profile_settings(uuid[]) to anon, authenticated;
