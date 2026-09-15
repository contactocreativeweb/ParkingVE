-- 013_parking_sessions.sql
create table public.parking_sessions (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete restrict,
  customer_id uuid
    references public.customers(id)
    on delete set null,
  vehicle_id uuid not null
    references public.vehicles(id)
    on delete restrict,
  plate_snapshot text not null,
  vehicle_type_snapshot public.vehicle_type not null,
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  status public.session_status not null default 'ACTIVE',
  lost_ticket boolean not null default false,
  parking_fee numeric(12,2) not null default 0,
  lost_ticket_fee numeric(12,2) not null default 0,
  additional_services_total numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency_code text not null default 'USD',
  customer_email text,
  customer_phone text,
  entry_operator_id uuid
    references public.profiles(id)
    on delete set null,
  exit_operator_id uuid
    references public.profiles(id)
    on delete set null,
  entry_notes text,
  exit_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
