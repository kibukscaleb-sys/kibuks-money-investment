-- HUT 10 PRO account deletion function
-- Run this once in Supabase SQL Editor.
-- The website requires: active session + current password + exact phrase + checkbox.

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
