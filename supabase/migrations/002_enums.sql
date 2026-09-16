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
