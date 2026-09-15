-- 002_enums.sql
create type public.organization_role as enum (
  'OWNER',
  'ADMIN',
  'OPERATOR'
);

create type public.vehicle_type as enum (
  'CAR',
  'MOTORCYCLE'
);

create type public.payment_method_type as enum (
  'CASH',
  'POS',
  'MOBILE_PAYMENT',
  'BANK_TRANSFER'
);

create type public.session_status as enum (
  'ACTIVE',
  'PAYMENT_PENDING',
  'COMPLETED',
  'CANCELLED'
);

create type public.payment_status as enum (
  'PENDING',
  'RECEIPT_REQUIRED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

create type public.receipt_status as enum (
  'RECEIVED',
  'APPROVED',
  'REJECTED'
);

create type public.public_link_type as enum (
  'PAYMENT',
  'RECEIPT'
);

create type public.shift_status as enum (
  'OPEN',
  'CLOSED'
);
