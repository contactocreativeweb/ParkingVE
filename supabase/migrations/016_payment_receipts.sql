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
