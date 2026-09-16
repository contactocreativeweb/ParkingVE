-- 015_payments.sql
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete restrict,
  session_id uuid not null
    references public.parking_sessions(id)
    on delete restrict,
  payment_method_id uuid
    references public.payment_methods(id)
    on delete set null,
  method_type public.payment_method_type not null,
  amount numeric(12,2) not null,
  currency_code text not null default 'USD',
  status public.payment_status not null default 'PENDING',
  reference_number text,
  customer_email text,
  customer_phone text,
  paid_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid
    references public.profiles(id)
    on delete set null,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
