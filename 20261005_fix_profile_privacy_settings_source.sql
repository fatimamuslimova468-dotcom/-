-- Keep profile privacy settings in their canonical tables.
-- public.profiles contains only the public profile flags is_private/hide_likes;
-- interaction/download settings live in public.user_settings.

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
