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
