-- ============================================
-- KAONI DESIGN — Schema Supabase
-- ============================================
-- Esegui questo intero file in: Supabase Dashboard → SQL Editor → New query → Run

-- Tabella categorie (con sottocategorie salvate come JSON dentro la stessa riga)
create table if not exists categories (
  id text primary key,
  name text not null,
  subs jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Tabella prodotti
create table if not exists products (
  id text primary key,
  title text not null,
  price numeric(10,2) not null,
  category_id text references categories(id) on delete restrict,
  subcategory_id text,
  description text default '',
  sizes text default '',
  color text default '',
  material text default '',
  sku text default '',
  stock text default '',
  origin text default '',
  notes text default '',
  image_url text default '',
  created_at timestamptz default now()
);

-- Tabella ordini (creata dal backend dopo un pagamento riuscito, per tenere traccia)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  customer_email text,
  items jsonb not null,
  amount_total numeric(10,2),
  status text default 'pending',
  created_at timestamptz default now()
);

-- ============================================
-- Sicurezza (Row Level Security)
-- ============================================
-- Chiunque (anche non loggato) può LEGGERE categorie e prodotti: serve per mostrare il sito pubblico.
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;

create policy "Chiunque può leggere le categorie"
  on categories for select
  using (true);

create policy "Chiunque può leggere i prodotti"
  on products for select
  using (true);

-- NOTA IMPORTANTE SULLA SICUREZZA:
-- Le policy qui sotto permettono anche a chiunque conosca l'indirizzo del sito di scrivere
-- (inserire/modificare/eliminare) categorie e prodotti tramite le API di Supabase, aggirando
-- il login del pannello admin (che è solo estetico/lato browser, non una vera autenticazione).
-- È accettabile per una demo o un progetto personale poco esposto, ma se il sito cresce va
-- sostituito con una vera autenticazione Supabase (Supabase Auth) prima di renderlo pubblico
-- su larga scala.
create policy "Scrittura prodotti (demo, non sicura su larga scala)"
  on products for all
  using (true)
  with check (true);

create policy "Scrittura categorie (demo, non sicura su larga scala)"
  on categories for all
  using (true)
  with check (true);

-- Gli ordini li scrive solo il backend (Netlify Function) con la service role key,
-- quindi non serve una policy pubblica di scrittura qui.
create policy "Nessuno legge gli ordini dal browser"
  on orders for select
  using (false);
