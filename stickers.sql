-- «Смотрю»: сохранение пользовательских стикеров
-- Выполнить один раз в Supabase -> SQL Editor.

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

-- Хранилище используется существующее: smotry-videos / <user_id>/stickers/...
-- Клиентский код имеет локальный fallback, если таблица ещё не создана.
