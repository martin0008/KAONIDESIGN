-- Migrazione 4: campi extra del profilo (telefono, indirizzo predefinito, preferenze)
-- Esegui in Supabase → SQL Editor → New query → Run

alter table profiles add column if not exists phone text default '';
alter table profiles add column if not exists address_line1 text default '';
alter table profiles add column if not exists address_city text default '';
alter table profiles add column if not exists address_zip text default '';
alter table profiles add column if not exists address_country text default '';
alter table profiles add column if not exists newsletter_opt_in boolean not null default false;
