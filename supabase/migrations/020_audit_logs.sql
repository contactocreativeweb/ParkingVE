-- 020_audit_logs.sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid
    references public.organizations(id)
    on delete cascade,
  parking_lot_id uuid
    references public.parking_lots(id)
    on delete cascade,
  user_id uuid
    references public.profiles(id)
    on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
