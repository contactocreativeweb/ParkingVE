-- 006_parking_lots.sql
create table public.parking_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  name text not null,
  address text,
  phone text,
  email text,
  timezone text not null default 'America/Caracas',
  currency_code text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
