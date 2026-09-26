-- HUT 10 PRO recommended Supabase schema
-- Run this in Supabase SQL Editor after reviewing it.
-- This script does not contain or require a service_role key.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  phone text,
  country text,
  currency text not null default 'UGX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(18,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.investment_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  minimum_amount numeric(18,2) not null check (minimum_amount >= 0),
  term_days integer not null check (term_days > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.investment_plans(id),
  principal numeric(18,2) not null default 0 check (principal >= 0),
  profit numeric(18,2) not null default 0,
  status text not null default 'pending',
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal','investment','profit','refund')),
  amount numeric(18,2) not null check (amount >= 0),
  status text not null default 'pending',
  reference text unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal')),
  amount numeric(18,2) not null check (amount >= 1000),
  phone text not null,
  provider text not null check (provider in ('MTN Mobile Money','Airtel Money')),
  status text not null default 'pending',
  provider_reference text,
  created_at timestamptz not null default now()
);

create index if not exists investments_user_id_idx on public.investments(user_id);
create index if not exists transactions_user_id_created_at_idx on public.transactions(user_id, created_at desc);
create index if not exists payment_requests_user_id_created_at_idx on public.payment_requests(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.investment_plans enable row level security;
alter table public.investments enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_requests enable row level security;

revoke all on table public.profiles, public.wallets, public.investment_plans, public.investments, public.transactions, public.payment_requests from anon;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select on table public.wallets to authenticated;
grant select on table public.investment_plans to anon, authenticated;
grant select on table public.investments, public.transactions to authenticated;
grant select, insert on table public.payment_requests to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "investment_plans_public_read" on public.investment_plans;
create policy "investment_plans_public_read" on public.investment_plans for select to anon, authenticated using (is_active = true);

drop policy if exists "investments_select_own" on public.investments;
create policy "investments_select_own" on public.investments for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "payment_requests_select_own" on public.payment_requests;
drop policy if exists "payment_requests_insert_own" on public.payment_requests;
create policy "payment_requests_select_own" on public.payment_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "payment_requests_insert_own" on public.payment_requests for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_hut10_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, phone, currency)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone', 'UGX')
  on conflict (user_id) do nothing;

  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_hut10 on auth.users;
create trigger on_auth_user_created_hut10
after insert on auth.users
for each row execute procedure public.handle_new_hut10_user();

insert into public.investment_plans (name, minimum_amount, term_days, description, is_active)
select 'Starter Plan', 50000, 30, 'Entry plan preview for HUT 10 PRO', true
where not exists (select 1 from public.investment_plans where name = 'Starter Plan');

insert into public.investment_plans (name, minimum_amount, term_days, description, is_active)
select 'Growth Plan', 250000, 90, 'Growth plan preview for HUT 10 PRO', true
where not exists (select 1 from public.investment_plans where name = 'Growth Plan');


-- Secure self-service account deletion.
-- The client must already have a valid authenticated session.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.payment_requests where user_id = uid;
  delete from public.transactions where user_id = uid;
  delete from public.investments where user_id = uid;
  delete from public.wallets where user_id = uid;
  delete from public.profiles where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
