-- Migrazione 3: profili utente (con ruolo admin), dati ordine completi, avatar
-- Esegui in Supabase → SQL Editor → New query → Run

-- ============================================
-- 1. Tabella profili — un profilo per ogni utente registrato
-- ============================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  avatar_url text default '',
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Un utente vede il proprio profilo"
  on profiles for select
  using (auth.uid() = id);

create policy "Un utente modifica il proprio profilo"
  on profiles for update
  using (auth.uid() = id);

create policy "Un utente crea il proprio profilo"
  on profiles for insert
  with check (auth.uid() = id);

-- Crea automaticamente un profilo ogni volta che qualcuno si registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 2. Colonne extra sugli ordini: nome, telefono, indirizzo di spedizione
-- ============================================
alter table orders add column if not exists customer_name text default '';
alter table orders add column if not exists customer_phone text default '';
alter table orders add column if not exists shipping_address jsonb;

-- ============================================
-- 3. Gli admin possono vedere TUTTI gli ordini (oltre al cliente che vede i propri)
-- ============================================
create policy "Gli admin vedono tutti gli ordini"
  on orders for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- 4. Storage per le foto avatar
-- ============================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Chiunque pu\u00f2 vedere gli avatar (sono pubblici)"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Un utente carica solo il proprio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Un utente aggiorna solo il proprio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- 5. IMPORTANTE — Marca il TUO account come amministratore
-- ============================================
-- Prima registrati normalmente sul sito con la tua email personale (come faresti
-- da cliente qualsiasi). POI esegui questa riga sostituendo con la tua vera email:

-- update profiles set is_admin = true where id = (select id from auth.users where email = 'tuaemail@esempio.com');
