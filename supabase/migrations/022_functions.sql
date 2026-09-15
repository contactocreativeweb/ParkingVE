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
