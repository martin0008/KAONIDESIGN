-- Migrazione 5: impostazioni del sito (contatti, testi legali) + personalizzazione nome profilo
-- Esegui in Supabase → SQL Editor → New query → Run

-- ============================================
-- 1. Impostazioni del sito — una sola riga con tutti i valori
-- ============================================
create table if not exists site_settings (
  id int primary key default 1,
  contact_email text default '',
  contact_phone text default '',
  store_address text default '',
  terms_text text default '',
  privacy_text text default '',
  returns_text text default '',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;

create policy "Chiunque può leggere le impostazioni del sito"
  on site_settings for select
  using (true);

create policy "Solo gli admin modificano le impostazioni del sito"
  on site_settings for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- ============================================
-- 2. Personalizzazione nome profilo (colore + font)
-- ============================================
alter table profiles add column if not exists name_color text default '#ff3b3b';
alter table profiles add column if not exists name_font text default 'default';
