-- ==========================================
-- File: 001_extensions.sql
-- ==========================================
-- 001_extensions.sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ==========================================
-- File: 002_enums.sql
-- ==========================================
-- 002_enums.sql
do $$ begin
  create type public.organization_role as enum (
    'OWNER',
    'ADMIN',
    'OPERATOR'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.vehicle_type as enum (
    'CAR',
    'MOTORCYCLE'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method_type as enum (
    'CASH',
    'POS',
    'MOBILE_PAYMENT',
    'BANK_TRANSFER'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_status as enum (
    'ACTIVE',
    'PAYMENT_PENDING',
    'COMPLETED',
    'CANCELLED'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum (
    'PENDING',
    'RECEIPT_REQUIRED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.receipt_status as enum (
    'RECEIVED',
    'APPROVED',
    'REJECTED'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.public_link_type as enum (
    'PAYMENT',
    'RECEIPT'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.shift_status as enum (
    'OPEN',
    'CLOSED'
  );
exception
  when duplicate_object then null;
end $$;


-- ==========================================
-- File: 003_profiles.sql
-- ==========================================
-- 003_profiles.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ==========================================
-- File: 004_organizations.sql
-- ==========================================
-- 004_organizations.sql
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  identification_number text,
  phone text,
  email text,
  address text,
  country_code text not null default 'VE',
  currency_code text not null default 'USD',
  timezone text not null default 'America/Caracas',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ==========================================
-- File: 005_organization_members.sql
-- ==========================================
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


-- ==========================================
-- File: 006_parking_lots.sql
-- ==========================================
-- 006_parking_lots.sql
create table if not exists public.parking_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  name text not null,
  address text,
  phone text,
  email text,
  timezone text not null default 'America/Caracas',
  currency_code text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ==========================================
-- File: 007_parking_lot_members.sql
-- ==========================================
-- 007_parking_lot_members.sql
create table if not exists public.parking_lot_members (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  unique (parking_lot_id, user_id)
);


-- ==========================================
-- File: 008_customers.sql
-- ==========================================
-- 008_customers.sql
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  identification_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ==========================================
-- File: 009_vehicles.sql
-- ==========================================
-- 009_vehicles.sql
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  customer_id uuid
    references public.customers(id)
    on delete set null,
  plate text not null,
  vehicle_type public.vehicle_type not null,
  brand text,
  model text,
  color text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parking_lot_id, plate)
);


-- ==========================================
-- File: 010_tariffs.sql
-- ==========================================
-- 010_tariffs.sql
create table if not exists public.tariffs (
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


-- ==========================================
-- File: 011_additional_services.sql
-- ==========================================
-- 011_additional_services.sql
create table if not exists public.additional_services (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null
    references public.parking_lots(id)
    on delete cascade,
  name text not null,
  price numeric(12,2) not null,
  currency_code text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ==========================================
-- File: 012_payment_methods.sql
-- ==========================================
-- 012_payment_methods.sql
create table if not exists public.payment_methods (
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


-- ==========================================
-- File: 013_parking_sessions.sql
-- ==========================================
-- 013_parking_sessions.sql
create table if not exists public.parking_sessions (
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


-- ==========================================
-- File: 014_session_services.sql
-- ==========================================
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


-- ==========================================
-- File: 015_payments.sql
-- ==========================================
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


-- ==========================================
-- File: 016_payment_receipts.sql
-- ==========================================
-- 016_payment_receipts.sql
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null
    references public.payments(id)
    on delete cascade,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  status public.receipt_status not null default 'RECEIVED',
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
    references public.profiles(id)
    on delete set null,
  rejection_reason text
);


-- ==========================================
-- File: 017_public_links.sql
-- ==========================================
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


-- ==========================================
-- File: 018_receipts.sql
-- ==========================================
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


-- ==========================================
-- File: 019_shifts.sql
-- ==========================================
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


-- ==========================================
-- File: 020_audit_logs.sql
-- ==========================================
-- 020_audit_logs.sql
create table if not exists public.audit_logs (
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


-- ==========================================
-- File: 021_indexes.sql
-- ==========================================
-- 021_indexes.sql
create index if not exists idx_org_members_user
  on public.organization_members(user_id);

create index if not exists idx_org_members_org
  on public.organization_members(organization_id);

create index if not exists idx_parking_lots_org
  on public.parking_lots(organization_id);

create index if not exists idx_parking_lot_members_user
  on public.parking_lot_members(user_id);

create index if not exists idx_customers_parking
  on public.customers(parking_lot_id);

create index if not exists idx_customers_email
  on public.customers(parking_lot_id, email);

create index if not exists idx_vehicles_parking_plate
  on public.vehicles(parking_lot_id, plate);

create index if not exists idx_vehicles_customer
  on public.vehicles(customer_id);

create index if not exists idx_sessions_parking_status
  on public.parking_sessions(parking_lot_id, status);

create index if not exists idx_sessions_plate
  on public.parking_sessions(parking_lot_id, plate_snapshot);

create index if not exists idx_sessions_entry
  on public.parking_sessions(parking_lot_id, entry_at);

create index if not exists idx_payments_session
  on public.payments(session_id);

create index if not exists idx_payments_status
  on public.payments(parking_lot_id, status);

create index if not exists idx_receipts_payment
  on public.payment_receipts(payment_id);

create index if not exists idx_public_links_token
  on public.public_payment_links(token_hash);

create index if not exists idx_audit_logs_parking_date
  on public.audit_logs(parking_lot_id, created_at desc);

-- Regla 32: Unicidad de sesión activa por vehículo y parking lot
create unique index if not exists idx_one_active_session_per_vehicle
  on public.parking_sessions(parking_lot_id, vehicle_id)
  where status in ('ACTIVE', 'PAYMENT_PENDING');


-- ==========================================
-- File: 022_functions.sql
-- ==========================================
-- 022_functions.sql

-- 1. Función para normalizar placas vehiculares (mayúsculas, sin espacios ni caracteres especiales)
create or replace function public.normalize_plate(raw_plate text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(raw_plate, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Trigger para normalizar placa antes de insertar/actualizar en vehicles
create or replace function public.trg_normalize_vehicle_plate()
returns trigger
language plpgsql
as $$
begin
  new.plate := public.normalize_plate(new.plate);
  return new;
end;
$$;

drop trigger if exists trg_normalize_plate_vehicles on public.vehicles;
create trigger trg_normalize_plate_vehicles
  before insert or update on public.vehicles
  for each row execute function public.trg_normalize_vehicle_plate();

-- Trigger para normalizar snapshot de placa en parking_sessions
create or replace function public.trg_normalize_session_plate_snapshot()
returns trigger
language plpgsql
as $$
begin
  new.plate_snapshot := public.normalize_plate(new.plate_snapshot);
  return new;
end;
$$;

drop trigger if exists trg_normalize_plate_sessions on public.parking_sessions;
create trigger trg_normalize_plate_sessions
  before insert or update on public.parking_sessions
  for each row execute function public.trg_normalize_session_plate_snapshot();

-- 2. Función genérica para setear updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers de updated_at para tablas correspondientes
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();

drop trigger if exists set_parking_lots_updated_at on public.parking_lots;
create trigger set_parking_lots_updated_at before update on public.parking_lots for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

drop trigger if exists set_vehicles_updated_at on public.vehicles;
create trigger set_vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();

drop trigger if exists set_tariffs_updated_at on public.tariffs;
create trigger set_tariffs_updated_at before update on public.tariffs for each row execute function public.set_updated_at();

drop trigger if exists set_additional_services_updated_at on public.additional_services;
create trigger set_additional_services_updated_at before update on public.additional_services for each row execute function public.set_updated_at();

drop trigger if exists set_payment_methods_updated_at on public.payment_methods;
create trigger set_payment_methods_updated_at before update on public.payment_methods for each row execute function public.set_updated_at();

drop trigger if exists set_parking_sessions_updated_at on public.parking_sessions;
create trigger set_parking_sessions_updated_at before update on public.parking_sessions for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

-- 3. Trigger para crear perfil automáticamente al registrar usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update
  set
    first_name = coalesce(excluded.first_name, profiles.first_name),
    last_name = coalesce(excluded.last_name, profiles.last_name),
    phone = coalesce(excluded.phone, profiles.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Cálculo seguro de tarifas y totales en backend (Regla 39)
create or replace function public.recalculate_session_total(p_session_id uuid)
returns numeric
language plpgsql
security definer
as $$
declare
  v_parking_fee numeric(12,2) := 0;
  v_lost_ticket_fee numeric(12,2) := 0;
  v_services_total numeric(12,2) := 0;
  v_grand_total numeric(12,2) := 0;
  v_lost_ticket boolean;
  v_parking_lot_id uuid;
  v_vehicle_type public.vehicle_type;
begin
  select parking_lot_id, vehicle_type_snapshot, lost_ticket
  into v_parking_lot_id, v_vehicle_type, v_lost_ticket
  from public.parking_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Sesión no encontrada: %', p_session_id;
  end if;

  -- Obtener tarifa configurada
  select daily_price, (case when v_lost_ticket then lost_ticket_price else 0 end)
  into v_parking_fee, v_lost_ticket_fee
  from public.tariffs
  where parking_lot_id = v_parking_lot_id and vehicle_type = v_vehicle_type;

  v_parking_fee := coalesce(v_parking_fee, 0);
  v_lost_ticket_fee := coalesce(v_lost_ticket_fee, 0);

  -- Sumar servicios adicionales de la sesión
  select coalesce(sum(total_price), 0)
  into v_services_total
  from public.session_additional_services
  where session_id = p_session_id;

  v_grand_total := v_parking_fee + v_lost_ticket_fee + v_services_total;

  update public.parking_sessions
  set
    parking_fee = v_parking_fee,
    lost_ticket_fee = v_lost_ticket_fee,
    additional_services_total = v_services_total,
    total_amount = v_grand_total
  where id = p_session_id;

  return v_grand_total;
end;
$$;


-- ==========================================
-- File: 023_rls.sql
-- ==========================================
-- 023_rls.sql

-- Activar RLS en todas las tablas públicas
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.parking_lots enable row level security;
alter table public.parking_lot_members enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.tariffs enable row level security;
alter table public.additional_services enable row level security;
alter table public.payment_methods enable row level security;
alter table public.parking_sessions enable row level security;
alter table public.session_additional_services enable row level security;
alter table public.payments enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.public_payment_links enable row level security;
alter table public.receipts enable row level security;
alter table public.shifts enable row level security;
alter table public.audit_logs enable row level security;

-- Funciones auxiliares de seguridad (Security Definer) para verificar membresías y permisos sin recursión
create or replace function public.user_has_org_membership(p_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.user_org_role(p_org_id uuid)
returns public.organization_role
language sql
security definer
stable
as $$
  select role
  from public.organization_members
  where organization_id = p_org_id
    and user_id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.user_has_parking_lot_access(p_parking_lot_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.parking_lots pl
    join public.organization_members om on om.organization_id = pl.organization_id
    left join public.parking_lot_members plm on plm.parking_lot_id = pl.id and plm.user_id = auth.uid()
    where pl.id = p_parking_lot_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and (
        om.role in ('OWNER', 'ADMIN')
        or plm.id is not null
      )
  );
$$;

-- 1. Políticas para PROFILES
drop policy if exists "Los usuarios pueden ver su propio perfil" on public.profiles;
create policy "Los usuarios pueden ver su propio perfil" on public.profiles for select
  using (id = auth.uid() or exists (
    select 1 from public.organization_members om1
    join public.organization_members om2 on om1.organization_id = om2.organization_id
    where om1.user_id = auth.uid() and om2.user_id = public.profiles.id
  ));

drop policy if exists "Los usuarios pueden actualizar su propio perfil" on public.profiles;
create policy "Los usuarios pueden actualizar su propio perfil" on public.profiles for update
  using (id = auth.uid());

-- 2. Políticas para ORGANIZATIONS
drop policy if exists "Miembros activos pueden ver su organizacion" on public.organizations;
create policy "Miembros activos pueden ver su organizacion" on public.organizations for select
  using (public.user_has_org_membership(id));

drop policy if exists "Solo OWNER o ADMIN pueden actualizar su organizacion" on public.organizations;
create policy "Solo OWNER o ADMIN pueden actualizar su organizacion" on public.organizations for update
  using (public.user_org_role(id) in ('OWNER', 'ADMIN'));

-- 3. Políticas para ORGANIZATION_MEMBERS
drop policy if exists "Miembros de la org pueden ver otros miembros" on public.organization_members;
create policy "Miembros de la org pueden ver otros miembros" on public.organization_members for select
  using (public.user_has_org_membership(organization_id));

drop policy if exists "OWNER y ADMIN pueden gestionar miembros" on public.organization_members;
create policy "OWNER y ADMIN pueden gestionar miembros" on public.organization_members for all
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN'));

-- 4. Políticas para PARKING_LOTS
drop policy if exists "Ver estacionamientos autorizados" on public.parking_lots;
create policy "Ver estacionamientos autorizados" on public.parking_lots for select
  using (public.user_has_parking_lot_access(id));

drop policy if exists "OWNER y ADMIN pueden modificar estacionamientos" on public.parking_lots;
create policy "OWNER y ADMIN pueden modificar estacionamientos" on public.parking_lots for all
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN'));

-- 5. Políticas para PARKING_LOT_MEMBERS
drop policy if exists "Ver asignaciones de operadores" on public.parking_lot_members;
create policy "Ver asignaciones de operadores" on public.parking_lot_members for select
  using (public.user_has_parking_lot_access(parking_lot_id));

drop policy if exists "OWNER y ADMIN pueden asignar operadores a estacionamiento" on public.parking_lot_members;
create policy "OWNER y ADMIN pueden asignar operadores a estacionamiento" on public.parking_lot_members for all
  using (
    exists (
      select 1 from public.parking_lots pl
      where pl.id = parking_lot_members.parking_lot_id
        and public.user_org_role(pl.organization_id) in ('OWNER', 'ADMIN')
    )
  );

-- 6. Políticas para CUSTOMERS
drop policy if exists "Operadores y administradores pueden ver y gestionar clientes" on public.customers;
create policy "Operadores y administradores pueden ver y gestionar clientes" on public.customers for all
  using (public.user_has_parking_lot_access(parking_lot_id))
  with check (public.user_has_parking_lot_access(parking_lot_id));

-- 7. Políticas para VEHICLES
drop policy if exists "Operadores y administradores pueden ver y gestionar vehiculos" on public.vehicles;
create policy "Operadores y administradores pueden ver y gestionar vehiculos" on public.vehicles for all
  using (public.user_has_parking_lot_access(parking_lot_id))
  with check (public.user_has_parking_lot_access(parking_lot_id));

-- 8. Políticas para TARIFFS
drop policy if exists "Ver tarifas del estacionamiento" on public.tariffs;
create policy "Ver tarifas del estacionamiento" on public.tariffs for select
  using (public.user_has_parking_lot_access(parking_lot_id));

drop policy if exists "Solo OWNER y ADMIN pueden modificar tarifas" on public.tariffs;
create policy "Solo OWNER y ADMIN pueden modificar tarifas" on public.tariffs for all
  using (
    exists (
      select 1 from public.parking_lots pl
      where pl.id = tariffs.parking_lot_id
        and public.user_org_role(pl.organization_id) in ('OWNER', 'ADMIN')
    )
  );

-- 9. Políticas para ADDITIONAL_SERVICES
drop policy if exists "Ver servicios adicionales" on public.additional_services;
create policy "Ver servicios adicionales" on public.additional_services for select
  using (public.user_has_parking_lot_access(parking_lot_id));

drop policy if exists "Solo OWNER y ADMIN pueden modificar servicios adicionales" on public.additional_services;
create policy "Solo OWNER y ADMIN pueden modificar servicios adicionales" on public.additional_services for all
  using (
    exists (
      select 1 from public.parking_lots pl
      where pl.id = additional_services.parking_lot_id
        and public.user_org_role(pl.organization_id) in ('OWNER', 'ADMIN')
    )
  );

-- 10. Políticas para PAYMENT_METHODS
drop policy if exists "Ver metodos de pago" on public.payment_methods;
create policy "Ver metodos de pago" on public.payment_methods for select
  using (public.user_has_parking_lot_access(parking_lot_id));

drop policy if exists "Solo OWNER y ADMIN pueden modificar metodos de pago" on public.payment_methods;
create policy "Solo OWNER y ADMIN pueden modificar metodos de pago" on public.payment_methods for all
  using (
    exists (
      select 1 from public.parking_lots pl
      where pl.id = payment_methods.parking_lot_id
        and public.user_org_role(pl.organization_id) in ('OWNER', 'ADMIN')
    )
  );

-- 11. Políticas para PARKING_SESSIONS
drop policy if exists "Gestionar sesiones del estacionamiento autorizado" on public.parking_sessions;
create policy "Gestionar sesiones del estacionamiento autorizado" on public.parking_sessions for all
  using (public.user_has_parking_lot_access(parking_lot_id))
  with check (public.user_has_parking_lot_access(parking_lot_id));

-- 12. Políticas para SESSION_ADDITIONAL_SERVICES
drop policy if exists "Gestionar servicios de la sesion" on public.session_additional_services;
create policy "Gestionar servicios de la sesion" on public.session_additional_services for all
  using (
    exists (
      select 1 from public.parking_sessions ps
      where ps.id = session_additional_services.session_id
        and public.user_has_parking_lot_access(ps.parking_lot_id)
    )
  );

-- 13. Políticas para PAYMENTS
drop policy if exists "Operadores y administradores pueden gestionar pagos" on public.payments;
create policy "Operadores y administradores pueden gestionar pagos" on public.payments for all
  using (public.user_has_parking_lot_access(parking_lot_id))
  with check (public.user_has_parking_lot_access(parking_lot_id));

-- 14. Políticas para PAYMENT_RECEIPTS (comprobantes de pago)
drop policy if exists "Ver y revisar comprobantes de pago de su estacionamiento" on public.payment_receipts;
create policy "Ver y revisar comprobantes de pago de su estacionamiento" on public.payment_receipts for all
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_receipts.payment_id
        and public.user_has_parking_lot_access(p.parking_lot_id)
    )
  );

-- 15. Políticas para PUBLIC_PAYMENT_LINKS (acceso público seguro y del operador)
drop policy if exists "Operadores gestionan links de pago" on public.public_payment_links;
create policy "Operadores gestionan links de pago" on public.public_payment_links for all
  using (public.user_has_parking_lot_access(parking_lot_id))
  with check (public.user_has_parking_lot_access(parking_lot_id));

drop policy if exists "Acceso publico por token anonimo activo y vigente" on public.public_payment_links;
create policy "Acceso publico por token anonimo activo y vigente" on public.public_payment_links for select
  using (
    is_active = true
    and (expires_at is null or expires_at > now())
  );

-- 16. Políticas para RECEIPTS
drop policy if exists "Ver recibos del estacionamiento autorizado" on public.receipts;
create policy "Ver recibos del estacionamiento autorizado" on public.receipts for all
  using (public.user_has_parking_lot_access(parking_lot_id));

-- 17. Políticas para SHIFTS (caja y turnos)
drop policy if exists "Gestionar turnos de caja" on public.shifts;
create policy "Gestionar turnos de caja" on public.shifts for all
  using (public.user_has_parking_lot_access(parking_lot_id))
  with check (public.user_has_parking_lot_access(parking_lot_id));

-- 18. Políticas para AUDIT_LOGS
drop policy if exists "Solo OWNER y ADMIN pueden ver logs de auditoria" on public.audit_logs;
create policy "Solo OWNER y ADMIN pueden ver logs de auditoria" on public.audit_logs for select
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  );

drop policy if exists "Insertar logs de auditoria" on public.audit_logs;
create policy "Insertar logs de auditoria" on public.audit_logs for insert
  with check (
    organization_id is not null
  );
-- 024_setup_tenant_rpc.sql

-- 1. Políticas de inserción necesarias para organizaciones y miembros
drop policy if exists "Usuarios autenticados pueden crear organizaciones" on public.organizations;
create policy "Usuarios autenticados pueden crear organizaciones" on public.organizations for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Usuarios pueden registrarse como miembros de su org" on public.organization_members;
create policy "Usuarios pueden registrarse como miembros de su org" on public.organization_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "Miembros autorizados pueden insertar estacionamientos" on public.parking_lots;
create policy "Miembros autorizados pueden insertar estacionamientos" on public.parking_lots for insert
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN'));

drop policy if exists "Asignar miembros a estacionamientos" on public.parking_lot_members;
create policy "Asignar miembros a estacionamientos" on public.parking_lot_members for insert
  with check (
    exists (
      select 1 from public.parking_lots pl
      where pl.id = parking_lot_members.parking_lot_id
        and public.user_org_role(pl.organization_id) in ('OWNER', 'ADMIN')
    )
    or auth.uid() = user_id
  );

drop policy if exists "Solo OWNER y ADMIN pueden insertar tarifas" on public.tariffs;
create policy "Solo OWNER y ADMIN pueden insertar tarifas" on public.tariffs for insert
  with check (
    exists (
      select 1 from public.parking_lots pl
      where pl.id = tariffs.parking_lot_id
        and public.user_org_role(pl.organization_id) in ('OWNER', 'ADMIN')
    )
  );

-- 2. Función RPC para configuración inicial atómica y segura
create or replace function public.setup_initial_tenant(
  p_org_name text,
  p_parking_name text,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_parking_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- 1. Crear Organización
  insert into public.organizations (name, country_code, currency_code, timezone, is_active)
  values (trim(p_org_name), 'VE', 'USD', 'America/Caracas', true)
  returning id into v_org_id;

  -- 2. Asociar Usuario como OWNER
  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (v_org_id, v_user_id, 'OWNER', true);

  -- 3. Crear Estacionamiento
  insert into public.parking_lots (organization_id, name, address, timezone, currency_code, is_active)
  values (v_org_id, coalesce(nullif(trim(p_parking_name), ''), 'Sede Principal'), trim(p_address), 'America/Caracas', 'USD', true)
  returning id into v_parking_id;

  -- 4. Asignar usuario al estacionamiento
  insert into public.parking_lot_members (parking_lot_id, user_id)
  values (v_parking_id, v_user_id);

  -- 5. Crear tarifas por defecto
  insert into public.tariffs (parking_lot_id, vehicle_type, daily_price, lost_ticket_price, currency_code, is_active)
  values 
    (v_parking_id, 'CAR', 2.0, 10.0, 'USD', true),
    (v_parking_id, 'MOTORCYCLE', 1.0, 5.0, 'USD', true);

  return jsonb_build_object(
    'organization_id', v_org_id,
    'parking_lot_id', v_parking_id
  );
end;
$$;
