-- 008_customers.sql
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  identification_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
