-- 004_organizations.sql
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  identification_number text,
  phone text,
  email text,
  address text,
  country_code text not null default 'VE',
  currency_code text not null default 'USD',
  timezone text not null default 'America/Caracas',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
