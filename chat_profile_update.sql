-- Chat and profile UX update for «Смотрю».
-- Non-destructive patch for the existing project.

-- 1) Per-user chat state: custom title and soft deletion from the current user's list.
alter table public.conversation_members
  add column if not exists custom_name text null,
  add column if not exists hidden_at timestamptz null;

create index if not exists conversation_members_user_visible_idx
  on public.conversation_members(user_id, hidden_at, updated_at desc);

-- 2) Track message edits.
alter table public.messages
  add column if not exists edited_at timestamptz null;

-- Realtime must be able to identify DELETEs by conversation_id; DELETE filters are not supported.
alter table public.messages replica identity full;

-- 3) Weekly limit: avatar changes are allowed at any time.
--    Only name/display_name/username changes consume the 7-day cooldown.
create or replace function public.enforce_profile_edit_weekly()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if OLD.name is distinct from NEW.name
     or OLD.display_name is distinct from NEW.display_name
     or OLD.username is distinct from NEW.username then
    if OLD.profile_edit_last_at is not null
       and now() < OLD.profile_edit_last_at + interval '7 days' then
      raise exception using
        errcode = '42501',
        message = 'PROFILE_EDIT_COOLDOWN',
        detail = 'PROFILE_EDIT_AVAILABLE_AT=' || to_char(OLD.profile_edit_last_at + interval '7 days', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    end if;
    NEW.profile_edit_last_at := now();
  else
    NEW.profile_edit_last_at := OLD.profile_edit_last_at;
  end if;

  return NEW;
end;
$function$;

-- 4) Existing chat creation/sending RPCs: block users on the server and restore a soft-deleted chat on new messages.
create or replace function public.get_or_create_direct_chat(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  cid uuid;
  recipient_message_rule text := 'all';
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_other_user is null or p_other_user = me then raise exception 'INVALID_PARTNER'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then raise exception 'USER_NOT_FOUND'; end if;
  if exists (select 1 from public.user_blocks where blocker_id=me and blocked_id=p_other_user)
     or exists (select 1 from public.user_blocks where blocker_id=p_other_user and blocked_id=me) then
    raise exception 'USER_BLOCKED';
  end if;

  if not exists (
    select 1 from public.subscriptions
    where follower_id = me and following_id = p_other_user
  ) then
    raise exception 'FOLLOW_REQUIRED';
  end if;

  select coalesce(us.who_can_message, us.settings->>'who_can_message', 'all')
    into recipient_message_rule
  from public.user_settings us
  where us.user_id = p_other_user;

  if coalesce(recipient_message_rule,'all') = 'none' then
    raise exception 'MESSAGES_DISABLED';
  end if;

  select cm.conversation_id into cid
  from public.conversation_members cm
  where cm.user_id = me
    and exists (
      select 1 from public.conversation_members cm2
      where cm2.conversation_id=cm.conversation_id and cm2.user_id=p_other_user
    )
    and (select count(*) from public.conversation_members c3 where c3.conversation_id=cm.conversation_id)=2
  limit 1;

  if cid is not null then return cid; end if;

  insert into public.conversations(type,name,description,created_by)
  values('private','','',me)
  returning id into cid;

  insert into public.conversation_members(conversation_id,user_id,role)
  values(cid,me,'member'),(cid,p_other_user,'member');

  return cid;
end;
$function$;

create or replace function public.send_direct_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  msg public.messages;
  me uuid := auth.uid();
  other_user uuid;
  recipient_rule text := 'all';
  clean_body text:=trim(coalesce(p_body,''));
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if clean_body='' then raise exception 'EMPTY_MESSAGE'; end if;
  if length(clean_body)>2000 then raise exception 'MESSAGE_TOO_LONG'; end if;
  if not exists (select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=me) then raise exception 'NOT_A_MEMBER'; end if;

  select cm.user_id into other_user
  from public.conversation_members cm
  where cm.conversation_id=p_conversation_id and cm.user_id<>me
  order by cm.joined_at limit 1;

  if other_user is not null then
    if exists (select 1 from public.user_blocks where blocker_id=me and blocked_id=other_user)
       or exists (select 1 from public.user_blocks where blocker_id=other_user and blocked_id=me) then
      raise exception 'USER_BLOCKED';
    end if;

    select coalesce(us.who_can_message, us.settings->>'who_can_message', 'all')
      into recipient_rule
    from public.user_settings us
    where us.user_id=other_user;

    if coalesce(recipient_rule,'all')='none' then raise exception 'MESSAGES_DISABLED'; end if;
    if recipient_rule='followers' and not exists (
      select 1 from public.subscriptions where follower_id=me and following_id=other_user
    ) then raise exception 'FOLLOW_REQUIRED'; end if;
  end if;

  insert into public.messages(conversation_id,sender_id,body)
  values(p_conversation_id,me,clean_body)
  returning * into msg;

  update public.conversation_members
  set hidden_at=null, updated_at=now()
  where conversation_id=p_conversation_id and user_id in (me,other_user);

  return msg;
end;
$function$;

-- 5) Edit/delete own direct messages and keep the conversation preview in sync.
create or replace function public.edit_direct_message(p_message_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  msg public.messages;
  me uuid := auth.uid();
  clean_body text:=trim(coalesce(p_body,''));
  last_id uuid;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if clean_body='' then raise exception 'EMPTY_MESSAGE'; end if;
  if length(clean_body)>2000 then raise exception 'MESSAGE_TOO_LONG'; end if;

  select m.* into msg
  from public.messages m
  where m.id=p_message_id
    and m.sender_id=me
    and exists (select 1 from public.conversation_members cm where cm.conversation_id=m.conversation_id and cm.user_id=me)
  for update;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;

  update public.messages
  set body=clean_body, edited_at=now()
  where id=p_message_id
  returning * into msg;

  select m.id into last_id
  from public.messages m
  where m.conversation_id=msg.conversation_id
  order by m.created_at desc, m.id desc
  limit 1;
  if last_id=msg.id then
    update public.conversations
    set last_text=clean_body, last_sender=me, last_kind=msg.kind, updated_at=now()
    where id=msg.conversation_id;
  end if;
  return msg;
end;
$function$;

create or replace function public.delete_direct_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  msg public.messages;
  last_msg public.messages;
  me uuid := auth.uid();
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;

  select m.* into msg
  from public.messages m
  where m.id=p_message_id
    and m.sender_id=me
    and exists (select 1 from public.conversation_members cm where cm.conversation_id=m.conversation_id and cm.user_id=me)
  for update;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;

  delete from public.messages where id=p_message_id;

  select m.* into last_msg
  from public.messages m
  where m.conversation_id=msg.conversation_id
  order by m.created_at desc, m.id desc
  limit 1;

  if found then
    update public.conversations
    set last_text=last_msg.body, last_sender=last_msg.sender_id, last_kind=last_msg.kind, updated_at=now()
    where id=msg.conversation_id;
  else
    update public.conversations
    set last_text=null, last_sender=null, last_kind='text', updated_at=now()
    where id=msg.conversation_id;
  end if;
  return true;
end;
$function$;

revoke all on function public.edit_direct_message(uuid,text) from public;
grant execute on function public.edit_direct_message(uuid,text) to authenticated;
revoke all on function public.delete_direct_message(uuid) from public;
grant execute on function public.delete_direct_message(uuid) to authenticated;

-- Existing RPCs were already public in this project; keep their current client compatibility.
