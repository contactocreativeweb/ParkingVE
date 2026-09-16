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
