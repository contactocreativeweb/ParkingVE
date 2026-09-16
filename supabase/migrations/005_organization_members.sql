-- 005_organization_members.sql
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  role public.organization_role not null default 'OPERATOR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
