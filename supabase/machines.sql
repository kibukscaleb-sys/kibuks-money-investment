-- HUT 10 PRO machine catalogue and purchase requests
-- Run this in Supabase SQL Editor when you want machine orders stored server-side.

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  price numeric(18,2) not null check (price > 0),
  core_spec text,
  operation text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.machine_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  machine_id uuid not null references public.machines(id),
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

alter table public.machines enable row level security;
alter table public.machine_orders enable row level security;

revoke all on table public.machines, public.machine_orders from anon;
grant select on public.machines to anon, authenticated;
grant select, insert on public.machine_orders to authenticated;

drop policy if exists "machines_active_read" on public.machines;
create policy "machines_active_read" on public.machines
for select to anon, authenticated using (is_active = true);

drop policy if exists "machine_orders_select_own" on public.machine_orders;
create policy "machine_orders_select_own" on public.machine_orders
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "machine_orders_insert_own" on public.machine_orders;
create policy "machine_orders_insert_own" on public.machine_orders
for insert to authenticated with check ((select auth.uid()) = user_id);

insert into public.machines(name,category,price,core_spec,operation,description)
values
('AI Compute Node','GPU COMPUTE',1500000,'24 GB class GPU','24/7','Configured AI compute catalogue unit'),
('Edge AI Node','EDGE COMPUTE',650000,'16 GB RAM','Low power','Compact edge AI catalogue unit'),
('Storage Node','DATA STORAGE',900000,'8 TB SSD','24/7','High-speed storage catalogue unit'),
('Network Accelerator','NETWORK',1200000,'10 GbE class','24/7','Network infrastructure catalogue unit'),
('AI Workstation','CREATOR',5500000,'High-end CPU/GPU','Desktop','Creator and development workstation'),
('Rack Compute Server','DATA CENTER',7500000,'Multi-GPU ready','24/7','Rack-ready compute catalogue unit')
on conflict (name) do nothing;