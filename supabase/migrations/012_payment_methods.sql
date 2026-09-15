-- 012_payment_methods.sql
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  method_type public.payment_method_type not null,
  display_name text not null,
  bank_name text,
  account_holder text,
  identification_number text,
  phone_number text,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
