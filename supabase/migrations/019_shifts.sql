-- 019_shifts.sql
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete restrict,
  operator_id uuid not null
    references public.profiles(id)
    on delete restrict,
  status public.shift_status not null default 'OPEN',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(12,2) not null default 0,
  expected_cash numeric(12,2) not null default 0,
  declared_cash numeric(12,2),
  cash_difference numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);
