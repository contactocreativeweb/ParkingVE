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
