-- Единая миграция для текущих ошибок проекта «Смотрю».
-- Выполнить один раз в Supabase SQL Editor.
-- Повторный запуск безопасен: используются IF NOT EXISTS / CREATE OR REPLACE.

-- ============================================================
-- 1. Настройки профиля, user_settings и follow_requests
-- ============================================================
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

-- ============================================================
-- ВАЖНО: выполните этот файл один раз в SQL Editor проекта,
-- иначе приватные аккаунты без таблицы follow_requests продолжат получать 404.
-- ============================================================
-- 2. Серверная модерация комментариев и saved_stickers
-- ============================================================
-- Усиленная серверная модерация для проекта «Смотрю».
-- Выполнить один раз в Supabase -> SQL Editor.
-- Клиентский фильтр есть, но эта функция является обязательным серверным слоем.

create extension if not exists fuzzystrmatch;

create or replace function public.normalize_comment_moderation(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(coalesce(p_text,'')),
    '[^a-zа-яё0-9@#$€_]+',
    '',
    'g'
  )
  ;
$$;

create or replace function public.comment_moderation_compact(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  s text := lower(coalesce(p_text,''));
begin
  s := translate(s,
    'абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
    'abvgdeezziiklmnoprstufxccssqyqeua'
  );
  s := regexp_replace(s, '@', 'a', 'g');
  s := regexp_replace(s, '\$', 's', 'g');
  s := regexp_replace(s, '€', 'e', 'g');
  s := regexp_replace(s, '0', 'o', 'g');
  s := regexp_replace(s, '[1!|]', 'i', 'g');
  s := regexp_replace(s, '2', 'z', 'g');
  s := regexp_replace(s, '3', 'e', 'g');
  s := regexp_replace(s, '4', 'a', 'g');
  s := regexp_replace(s, '5', 's', 'g');
  s := regexp_replace(s, '6', 'g', 'g');
  s := regexp_replace(s, '7', 't', 'g');
  s := regexp_replace(s, '8', 'b', 'g');
  s := regexp_replace(s, '9', 'g', 'g');
  s := regexp_replace(s, '[^a-z0-9]+', '', 'g');
  s := regexp_replace(s, '([a-z0-9])\1{2,}', '\1\1', 'g');
  return s;
end;
$$;

create or replace function public.comment_text_is_prohibited(p_text text)
returns boolean
language plpgsql
stable
as $$
declare
  compact text := public.comment_moderation_compact(p_text);
  term text;
  normalized_term text;
  tokens text[];
  loose_token text;
  shortened text;
  token text;
  i integer;
  piece text;
  max_dist integer;
  len_min integer;
  len_max integer;
  terms text[] := array[
    'хуй',
    'хуj',
    'xuy',
    'huy',
    'xui',
    'hui',
    'хер',
    'хуев',
    'хуёв',
    'хуйня',
    'хуйло',
    'хуйсос',
    'нахуй',
    'нахер',
    'похуй',
    'похуист',
    'охуеть',
    'охуенный',
    'охуительно',
    'пизд',
    'пизда',
    'пиздец',
    'пиздеж',
    'пиздёж',
    'пиздить',
    'пиздато',
    'пиздатый',
    'пиздюк',
    'пиздюлина',
    'пиздобол',
    'пиздоболить',
    'распиздяй',
    'распиздяйство',
    'спиздить',
    'выпиздить',
    'напиздеть',
    'опиздеть',
    'пиздецки',
    'пиздецкий',
    'бля',
    'бляд',
    'блядь',
    'блять',
    'блать',
    'блти',
    'блди',
    'блядство',
    'блядский',
    'блядская',
    'блдун',
    'блдунья',
    'блдовать',
    'бляха',
    'бляхомуха',
    'блядища',
    'блдюга',
    'блдюк',
    'блдюшник',
    'блдюшный',
    'блядствовать',
    'блядующий',
    'blya',
    'blyat',
    'blyad',
    'еб',
    'ёб',
    'еба',
    'ёба',
    'ебать',
    'ёбать',
    'ебаться',
    'ёбаться',
    'ебал',
    'ёбал',
    'ебало',
    'ёбало',
    'ебаный',
    'ебаная',
    'ебаное',
    'ебаные',
    'ебись',
    'ёбись',
    'еби',
    'ёби',
    'ебёт',
    'ёбёт',
    'ебут',
    'ёбут',
    'ебля',
    'ёбля',
    'еблядь',
    'ёблядь',
    'ебнутый',
    'ёбнутый',
    'ебнутая',
    'ёбнутая',
    'ебнутые',
    'ёбнутые',
    'ебнуться',
    'ёбнуться',
    'ебнуть',
    'ёбнуть',
    'ебоватый',
    'ёбоватый',
    'ебовый',
    'ёбовый',
    'ебош',
    'ёбош',
    'ебошить',
    'ёбошить',
    'ебошиться',
    'ёбошиться',
    'ебство',
    'ёбство',
    'ебствовать',
    'ёбствовать',
    'ебун',
    'ёбун',
    'ебунья',
    'ёбунья',
    'ебучий',
    'ёбучий',
    'ебучая',
    'ёбучая',
    'ебучее',
    'ёбучее',
    'ебучие',
    'ёбучие',
    'ебырь',
    'ёбырь',
    'ебырить',
    'ёбырить',
    'ебыриться',
    'ёбыриться',
    'fuck',
    'fucker',
    'motherfucker',
    'shit',
    'bitch',
    'пидор',
    'пидар',
    'пидорас',
    'пидорастия',
    'пидорский',
    'пидорская',
    'пидорское',
    'пидорские',
    'пидорство',
    'пидорствовать',
    'пидорок',
    'pidor',
    'pidar',
    'муд',
    'мудак',
    'мудачка',
    'мудаки',
    'мудацкий',
    'мудацкая',
    'мудацкое',
    'мудацкие',
    'мудачество',
    'мудачествовать',
    'мдила',
    'мдило',
    'сук',
    'сука',
    'сукин',
    'сукина',
    'сукино',
    'сукины',
    'сучка',
    'сучки',
    'суч',
    'сучий',
    'suka',
    'suk',
    'гандон',
    'гондон',
    'гандонский',
    'жоп',
    'жопа',
    'жопы',
    'жопный',
    'жопник',
    'задниц',
    'анус',
    'аналь',
    'ораль',
    'секс',
    'сексуаль',
    'порно',
    'порн',
    'эрот',
    'интим',
    'онан',
    'мастурб',
    'педо',
    'педофил',
    'педофилия',
    'зоо',
    'зоофил',
    'некро',
    'некрофил',
    'инцест',
    'изнасил',
    'насил',
    'извращ',
    'извращенец',
    'садист',
    'мазохист',
    'фетиш',
    'бдсм',
    'БДСМ',
    'ролев',
    'свинг',
    'группов',
    'оргия',
    'проститут',
    'шлюх',
    'путан',
    'стриптиз',
    'нудист',
    'нудизм',
    'эксгибиционист',
    'вуайерист',
    'мраз',
    'мразь',
    'тварь',
    'ублюд',
    'ублюдок',
    'гнид',
    'гнида',
    'долбо',
    'долбоёб',
    'долбоеб',
    'сволоч',
    'сволочь',
    'падл',
    'козел',
    'козл',
    'петух',
    'куриц',
    'яйц',
    'писюн',
    'письк',
    'сиськ',
    'титьк',
    'собак',
    'осел',
    'баран',
    'дебил',
    'идиот',
    'кретин',
    'даун',
    'лох',
    'чмо',
    'чмош',
    'быдл',
    'хам',
    'хамл',
    'нагл',
    'подл',
    'мерзав',
    'негод',
    'паразит',
    'гад',
    'гадюк',
    'змея',
    'шакал',
    'крыс',
    'свинь',
    'алкогол',
    'водк',
    'пив',
    'вин',
    'коньяк',
    'виски',
    'ром',
    'джин',
    'текил',
    'абсент',
    'самогон',
    'браг',
    'кур',
    'табак',
    'сигарет',
    'вейп',
    'снюс',
    'насвай',
    'кальян',
    'игр',
    'казин',
    'ставк',
    'букмекер',
    'лотере',
    'рулетк',
    'покер',
    'блэкджек',
    'слот',
    'автомат',
    'кредит',
    'займ',
    'долг',
    'микрозайм',
    'коллектор',
    'мошен',
    'обман',
    'развод',
    'скам',
    'фишинг',
    'взлом',
    'хакер',
    'вирус',
    'троян',
    'майнер',
    'ботнет',
    'ддос',
    'спам',
    'флуд',
    'тролл',
    'буллинг',
    'травл',
    'харас',
    'сталк',
    'домогат',
    'нарко',
    'спайс',
    'мефедрон',
    'героин',
    'кокаин',
    'амфетамин',
    'марихуан',
    'гашиш',
    'экстази',
    'лсд',
    'гриб',
    'наркотик'
  ];
begin
  if compact = '' then
    return false;
  end if;

  -- Точные/склеенные совпадения после удаления пробелов и символов.
  foreach term in array terms loop
    normalized_term := public.comment_moderation_compact(term);
    if normalized_term <> '' and position(normalized_term in compact) > 0 then
      return true;
    end if;
  end loop;

  -- Настоящие пробелы разделяют слова для ограниченной проверки опечаток.
  tokens := regexp_split_to_array(lower(coalesce(p_text,'')), '\s+');

  -- Один символ в слове мог быть заменён на знак: «пиз#ец» -> «pizec».
  -- Настоящие пробелы разделяют токены, а #/*/. внутри слова игнорируются.
  foreach term in array terms loop
    normalized_term := public.comment_moderation_compact(term);
    if length(normalized_term) < 4 then
      continue;
    end if;
    if array_length(tokens,1) is not null then
      foreach token in array regexp_split_to_array(
        regexp_replace(lower(coalesce(p_text,'')), '\s+', ' ', 'g'), ' '
      ) loop
        loose_token := public.comment_moderation_compact(token);
        for i in 1..greatest(0,length(normalized_term)-2) loop
          shortened := substr(normalized_term,1,i-1) || substr(normalized_term,i+1);
          if loose_token = shortened then
            return true;
          end if;
        end loop;
      end loop;
    end if;
  end loop;

  -- Для длинных запрещённых слов допускаем 1–2 изменения букв,
  -- но только для целого слова, а не для каждого фрагмента большого текста.
  if array_length(tokens,1) is not null then
    foreach token in array tokens loop
      token := public.comment_moderation_compact(token);
      if token = '' then continue; end if;
      foreach term in array terms loop
        normalized_term := public.comment_moderation_compact(term);
        if length(normalized_term) < 7 then continue; end if;
        max_dist := case when length(normalized_term) >= 9 then 2 else 1 end;
        if abs(length(token)-length(normalized_term)) <= max_dist
           and levenshtein_less_equal(token, normalized_term, max_dist) <= max_dist then
          return true;
        end if;
      end loop;
    end loop;
  end if;

  return false;
end;
$$;

create or replace function public.guard_comment_moderation()
returns trigger
language plpgsql
as $$
declare
  v_text text := coalesce(new.text, new.content, '');
begin
  -- Стикеры не содержат текст и остаются разрешены.
  if coalesce(new.comment_type,'text') <> 'sticker' and public.comment_text_is_prohibited(v_text) then
    raise exception using
      errcode = 'P0001',
      message = 'COMMENT_MODERATION: profanity';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_comment_moderation_strict on public.comments;
create trigger trg_comment_moderation_strict
before insert or update of text, content on public.comments
for each row execute function public.guard_comment_moderation();

-- Примеры проверки.
select public.comment_text_is_prohibited('хуй') as blocked_plain,
       public.comment_text_is_prohibited('х у й') as blocked_spaced,
       public.comment_text_is_prohibited('xuy') as blocked_latin,
       public.comment_text_is_prohibited('х*й') as blocked_symbols,
       public.comment_text_is_prohibited('бляяяя') as blocked_repeat,
       public.comment_text_is_prohibited('п-и-з-д-е-ц') as blocked_split,
       public.comment_text_is_prohibited('обычный комментарий') as normal_text_ok;

-- ========== SAVED STICKERS ==========
create table if not exists public.saved_stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sticker_id text not null,
  sticker_url text,
  created_at timestamptz not null default now(),
  unique(user_id, sticker_id)
);

alter table public.saved_stickers add column if not exists sticker_url text;
alter table public.saved_stickers enable row level security;

drop policy if exists saved_stickers_select_own on public.saved_stickers;
create policy saved_stickers_select_own on public.saved_stickers for select to authenticated using (user_id = auth.uid());
drop policy if exists saved_stickers_insert_own on public.saved_stickers;
create policy saved_stickers_insert_own on public.saved_stickers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists saved_stickers_update_own on public.saved_stickers;
create policy saved_stickers_update_own on public.saved_stickers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists saved_stickers_delete_own on public.saved_stickers;
create policy saved_stickers_delete_own on public.saved_stickers for delete to authenticated using (user_id = auth.uid());
