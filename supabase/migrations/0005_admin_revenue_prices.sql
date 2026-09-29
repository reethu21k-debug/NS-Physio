-- 0005_admin_revenue_prices.sql  (idempotent, run once in the Supabase SQL editor)

create index if not exists appointments_created_idx on public.appointments (created_at desc);

-- Monthly revenue. Counted statuses: payment_verified, confirmed, completed (money received or booking confirmed).
-- Not counted: pending, payment_submitted, cancelled, rejected. Grouped by appointment month; contact-priced (amount NULL) excluded.
create or replace function public.monthly_revenue(p_from date, p_to date)
returns table (month text, revenue numeric, bookings bigint)
language sql stable security invoker set search_path = public as $$
  select to_char(date_trunc('month', a.appointment_date), 'YYYY-MM'), coalesce(sum(a.amount), 0), count(*)
    from public.appointments a
   where a.appointment_date >= p_from and a.appointment_date < p_to
     and a.amount is not null
     and a.appointment_status in ('payment_verified', 'confirmed', 'completed')
   group by 1 order by 1;
$$;

-- Atomic bulk price update with audit trail (old -> new). Unchanged rows are skipped.
create or replace function public.update_service_prices(p_actor uuid, p_items jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare it jsonb; v_old public.services; v_type text; v_price numeric; n integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty' using errcode = 'P0422';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_old from public.services where id = (it->>'id')::uuid for update;
    if not found then raise exception 'unknown service' using errcode = 'P0404'; end if;
    v_type  := it->>'pricing_type';
    v_price := nullif(it->>'price', '')::numeric;
    if v_type not in ('fixed', 'starting_from', 'contact') then raise exception 'bad type' using errcode = 'P0422'; end if;
    if v_type <> 'contact' and (v_price is null or v_price <= 0) then raise exception 'bad price' using errcode = 'P0422'; end if;
    if v_price is not null and v_price <= 0 then raise exception 'bad price' using errcode = 'P0422'; end if;
    if v_old.pricing_type = v_type and v_old.price is not distinct from v_price then continue; end if;
    update public.services set pricing_type = v_type, price = v_price where id = v_old.id;
    insert into public.audit_logs (actor_user_id, action, entity, entity_id, changes)
      values (p_actor, 'SERVICE_PRICE_UPDATED', 'service', v_old.id::text,
              jsonb_build_object('old_price', v_old.price, 'new_price', v_price, 'old_type', v_old.pricing_type, 'new_type', v_type));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.monthly_revenue(date, date) from public, anon, authenticated;
grant  execute on function public.monthly_revenue(date, date) to service_role;
revoke execute on function public.update_service_prices(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.update_service_prices(uuid, jsonb) to service_role;