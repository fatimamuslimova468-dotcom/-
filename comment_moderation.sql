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
