-- 014_session_services.sql
create table if not exists public.session_additional_services (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.parking_sessions(id)
    on delete cascade,
  additional_service_id uuid
    references public.additional_services(id)
    on delete set null,
  service_name_snapshot text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null default 1,
  total_price numeric(12,2) not null,
  currency_code text not null default 'USD',
  created_at timestamptz not null default now()
);
