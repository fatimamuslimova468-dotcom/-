-- Усиленная серверная защита комментариев для «Смотрю».
-- Выполнить один раз в Supabase -> SQL Editor.
-- Клиентский фильтр остаётся, но эта функция не позволяет обойти его
-- прямым запросом к REST API.

create extension if not exists pg_trgm;

create or replace function public.normalize_comment_moderation(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower(coalesce(p_text,'')),
                'ё', 'е', 'g'
              ),
              '[хx]', 'x', 'g'
            ),
            '[уy]', 'y', 'g'
          ),
          '[аaàáâäãå]', 'a', 'g'
        ),
        '[еeèéêë]', 'e', 'g'
      ),
      '[оoòóôöõ]', 'o', 'g'
    ),
    '[сcç]', 'c', 'g'
  );
$$;

create or replace function public.comment_text_is_prohibited(p_text text)
returns boolean
language plpgsql
stable
as $$
declare
  raw text := public.normalize_comment_moderation(coalesce(p_text,''));
  compact text := regexp_replace(raw, '[^a-zа-я0-9]+', '', 'g');
  token text;
  term text;
  terms text[] := array[
    'бляд','блядь','бля','блять','ебан','ебать','ебл','еблан','ебись',
    'нахуй','нахер','пизд','пизда','пиздец','хуйн','хуйню','хуй','хуйня',
    'хуёв','мудак','мраз','сука','суч','шлюх','дроч','говн','дерьм',
    'залуп','уеб','уёб','ёб','fuck','fucker','motherfucker','shit','bitch',
    'дебил','идиот','кретин','тупица','тупой','урод','ничтож','жалк','лох',
    'лошар','долбо','придур','козел','козёл','чмо','даун','мусор','позор',
    'тварь','дегенерат','баран'
  ];
begin
  if compact = any(array['бл','блт','блть','блд','мдк','пзд','пздц','хйн','хй','еб']) then
    return true;
  end if;

  if compact ~ '(бл|блт|блть|блд|мдк|пзд|пздц|хйн|хй|еб)$'
     and length(compact) <= 8 then
    return true;
  end if;

  -- Точное вхождение после удаления пробелов/знаков: «х у й н я», «п-и-з-д-ц».
  foreach term in array terms loop
    if length(term) >= 3 and compact like '%' || regexp_replace(public.normalize_comment_moderation(term), '[^a-zа-я0-9]+', '', 'g') || '%' then
      return true;
    end if;
  end loop;

  -- Небольшие намеренные искажения в уже склеенном тексте:
  -- «хукня», «х у к н я», «х-у-к-н-я» и т.п.
  foreach term in array terms loop
    term := regexp_replace(public.normalize_comment_moderation(term), '[^a-z0-9а-я]+', '', 'g');
    if length(term) >= 4 then
      if abs(length(compact) - length(term)) <= case when length(term) >= 7 then 2 else 1 end
         and similarity(compact, term) >= case when length(term) >= 7 then 0.58 else 0.63 end
      then
        return true;
      end if;

      -- Ищем похожее короткое окно внутри длинного комментария.
      for token in
        select substr(compact, i, len)
        from generate_series(1, greatest(1, length(compact))) as i
        cross join lateral generate_series(
          greatest(1, length(term)-case when length(term)>=7 then 2 else 1 end),
          least(length(compact)-i+1, length(term)+case when length(term)>=7 then 2 else 1 end)
        ) as len
      loop
        if similarity(token, term) >= case when length(term) >= 7 then 0.58 else 0.63 end then
          return true;
        end if;
      end loop;
    end if;
  end loop;

  -- Небольшие намеренные искажения: замена/пропуск 1 буквы.
  for token in
    select x from regexp_split_to_table(
      trim(regexp_replace(raw, '[^a-z0-9а-я]+', ' ', 'g')),
      '\s+'
    ) as x
  loop
    foreach term in array terms loop
      term := regexp_replace(public.normalize_comment_moderation(term), '[^a-z0-9а-я]+', '', 'g');
      if length(term) >= 4
         and abs(length(token) - length(term)) <= case when length(term) >= 7 then 2 else 1 end
         and similarity(token, term) >= case when length(term) >= 7 then 0.58 else 0.63 end
      then
        return true;
      end if;
    end loop;
  end loop;

  return false;
end;
$$;

create or replace function public.guard_comment_moderation()
returns trigger
language plpgsql
as $$
  v_text text := coalesce(new.text, new.content, '');
begin
  if public.comment_text_is_prohibited(v_text) then
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
for each row
execute function public.guard_comment_moderation();

-- Проверка:
select public.comment_text_is_prohibited('бл') as blocked_bl,
       public.comment_text_is_prohibited('Хукня') as blocked_huknya,
       public.comment_text_is_prohibited('х у к н я') as blocked_spaced_huknya,
       public.comment_text_is_prohibited('блок') as normal_word_ok,
       public.comment_text_is_prohibited('обычный комментарий') as normal_text_ok;


-- ========== SAVED STICKERS ==========
-- Нужна для загрузки пользовательских стикеров и их хранения между входами.
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
create policy saved_stickers_select_own on public.saved_stickers
for select to authenticated using (user_id = auth.uid());

drop policy if exists saved_stickers_insert_own on public.saved_stickers;
create policy saved_stickers_insert_own on public.saved_stickers
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists saved_stickers_update_own on public.saved_stickers;
create policy saved_stickers_update_own on public.saved_stickers
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists saved_stickers_delete_own on public.saved_stickers;
create policy saved_stickers_delete_own on public.saved_stickers
for delete to authenticated using (user_id = auth.uid());
