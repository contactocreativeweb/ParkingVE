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
