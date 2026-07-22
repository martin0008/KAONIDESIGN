-- Migrazione 2: drop segreto + account clienti
-- Esegui in Supabase → SQL Editor → New query → Run

-- Colonna per marcare un prodotto come "esclusivo drop segreto"
alter table products add column if not exists is_secret boolean not null default false;

-- Permette a un cliente loggato di vedere i PROPRI ordini (in base all'email dell'account)
create policy "Un cliente vede solo i propri ordini"
  on orders for select
  using (customer_email = auth.jwt() ->> 'email');
