-- 009_vehicles.sql
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  customer_id uuid
    references public.customers(id)
    on delete set null,
  plate text not null,
  vehicle_type public.vehicle_type not null,
  brand text,
  model text,
  color text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parking_lot_id, plate)
);
