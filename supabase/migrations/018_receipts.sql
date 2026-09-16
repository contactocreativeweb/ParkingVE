-- 018_receipts.sql
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete restrict,
  session_id uuid not null unique
    references public.parking_sessions(id)
    on delete restrict,
  payment_id uuid
    references public.payments(id)
    on delete set null,
  receipt_number bigint generated always as identity,
  plate_snapshot text not null,
  vehicle_type_snapshot public.vehicle_type not null,
  entry_at timestamptz not null,
  exit_at timestamptz,
  subtotal numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  currency_code text not null,
  payment_method public.payment_method_type,
  created_at timestamptz not null default now()
);
