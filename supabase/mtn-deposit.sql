-- HUT 10 PRO / MTN Mobile Money deposit settlement
-- Run once in the Supabase SQL Editor.
-- This function is intentionally executable only by service_role,
-- so browser clients cannot credit their own wallets.

create or replace function public.finalize_mtn_deposit(
  p_payment_request_id uuid,
  p_provider_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.payment_requests%rowtype;
  inserted_count integer := 0;
begin
  select *
    into req
    from public.payment_requests
   where id = p_payment_request_id
     and type = 'deposit'
   for update;

  if not found then
    raise exception 'Deposit request not found';
  end if;

  if req.provider_reference is distinct from p_provider_reference then
    raise exception 'Provider reference mismatch';
  end if;

  if req.status = 'successful' then
    return jsonb_build_object(
      'status', 'already_successful',
      'payment_request_id', req.id
    );
  end if;

  insert into public.transactions (
    user_id,
    type,
    amount,
    status,
    reference,
    description
  )
  values (
    req.user_id,
    'deposit',
    req.amount,
    'completed',
    'MTN:' || req.provider_reference,
    'MTN Mobile Money deposit'
  )
  on conflict (reference) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.wallets
       set balance = balance + req.amount,
           updated_at = now()
     where user_id = req.user_id;

    if not found then
      raise exception 'Wallet not found';
    end if;
  end if;

  update public.payment_requests
     set status = 'successful'
   where id = req.id;

  return jsonb_build_object(
    'status', 'successful',
    'payment_request_id', req.id,
    'credited', inserted_count = 1,
    'amount', req.amount
  );
end;
$$;

revoke all on function public.finalize_mtn_deposit(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_mtn_deposit(uuid, text) to service_role;
