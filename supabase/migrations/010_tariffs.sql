-- 010_tariffs.sql
create table public.tariffs (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  vehicle_type public.vehicle_type not null,
  daily_price numeric(12,2) not null default 0,
  lost_ticket_price numeric(12,2) not null default 0,
  currency_code text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parking_lot_id, vehicle_type)
);
