-- 017_public_links.sql
create table if not exists public.public_payment_links (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  session_id uuid not null
    references public.parking_sessions(id)
    on delete cascade,
  payment_id uuid
    references public.payments(id)
    on delete cascade,
  link_type public.public_link_type not null,
  token_hash text not null unique,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
