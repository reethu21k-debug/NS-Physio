-- 0004_hardening.sql
-- Purpose: make the trusted Express API (service_role, which bypasses RLS) the ONLY writer of business state, so admins
-- (or anyone holding a user JWT) cannot change appointments / payments / services / settings / slots straight through
-- PostgREST and thereby skip status rules or audit logging.  0002_rls.sql is intentionally left untouched.
-- Additive and idempotent: safe to re-run; nothing is dropped except policies that granted direct writes.

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Remove direct-write policies that let an (authenticated) admin write via the DB API
-- ───────────────────────────────────────────────────────────────────────────────
drop policy if exists appts_admin_update    on public.appointments;
drop policy if exists payments_admin_update on public.payments;
drop policy if exists services_admin_write  on public.services;     -- FOR ALL (insert/update/delete)
drop policy if exists settings_admin_write  on public.clinic_settings;
drop policy if exists blocked_admin_all     on public.blocked_slots;

-- Keep admin READ access that the dropped FOR ALL policies used to provide.
-- (services_public_read already lets admins read every service; settings_read lets any authenticated user read settings.)
drop policy if exists blocked_admin_read on public.blocked_slots;
create policy blocked_admin_read on public.blocked_slots for select to authenticated using (public.is_admin());

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. Belt and braces: table privileges. Even if a permissive policy is added later by mistake,
--    anon/authenticated still cannot write. service_role is unaffected.
-- ───────────────────────────────────────────────────────────────────────────────
revoke insert, update, delete, truncate, references, trigger on
  public.appointments, public.payments, public.services, public.clinic_settings,
  public.blocked_slots, public.appointment_events, public.audit_logs
  from anon, authenticated;

-- profiles: users may still edit their own name/phone directly (policy profiles_update_own + protect_profile_fields trigger);
-- role / email / is_active can no longer be targeted at all. Rows are created by the auth trigger, never by clients.
revoke insert, delete, truncate, references, trigger on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;

-- payments: the payment-proof pointers (screenshot_url, cloudinary_public_id) and verified_by are not readable through the
-- DB API. Proofs are only delivered via short server-side authorisation + signed URLs (server/src/lib/cloudinary.ts).
-- NOTE: if any client code selects payments directly with select('*'), switch it to the API (or add columns here).
revoke select on public.payments from anon, authenticated;
grant  select (id, appointment_id, user_id, amount, payment_method, status, rejection_reason, submitted_at, verified_at)
  on public.payments to authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. Atomic, audited state transitions (called only by the API with the service-role key)
--    Custom SQLSTATEs: P0404 not found | P0409 state changed (API -> 409) | P0422 invalid input | P0429 limit reached.
--    Row locks (FOR UPDATE) + compare-with-observed-state + writes + event + audit all happen in ONE transaction.
--    Target statuses are SQL literals on purpose (works whether the columns are enums or text+check constraints).
-- ───────────────────────────────────────────────────────────────────────────────
create or replace function public.payment_submit_proof(
  p_appointment_id uuid, p_payment_id uuid, p_actor uuid,
  p_from_appt_status text, p_from_appt_pay_status text, p_from_pay_status text,
  p_url text, p_public_id text
) returns text language plpgsql security invoker set search_path = public as $$
declare v_appt public.appointments%rowtype; v_pay public.payments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found or v_appt.user_id is distinct from p_actor then raise exception 'not found' using errcode = 'P0404'; end if;
  select * into v_pay from public.payments where id = p_payment_id and appointment_id = p_appointment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0404'; end if;
  if v_appt.payment_method::text <> 'online'
     or v_appt.appointment_status::text is distinct from p_from_appt_status
     or v_appt.payment_status::text     is distinct from p_from_appt_pay_status
     or v_pay.status::text              is distinct from p_from_pay_status then
    raise exception 'state changed' using errcode = 'P0409';
  end if;
  update public.appointments set payment_status = 'submitted', appointment_status = 'payment_submitted' where id = p_appointment_id;
  update public.payments set screenshot_url = p_url, cloudinary_public_id = p_public_id, status = 'submitted',
         submitted_at = now(), rejection_reason = null, verified_by = null, verified_at = null where id = p_payment_id;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'PAYMENT_SUBMITTED', p_from_appt_status, 'payment_submitted', '{}'::jsonb);
  return v_pay.cloudinary_public_id;  -- previous proof, for the API to delete after commit
end $$;

create or replace function public.payment_verify(
  p_appointment_id uuid, p_payment_id uuid, p_actor uuid,
  p_from_appt_status text, p_from_appt_pay_status text, p_from_pay_status text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_appt public.appointments%rowtype; v_pay public.payments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0404'; end if;
  select * into v_pay from public.payments where id = p_payment_id and appointment_id = p_appointment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0404'; end if;
  if v_appt.appointment_status::text is distinct from p_from_appt_status
     or v_appt.payment_status::text  is distinct from p_from_appt_pay_status
     or v_pay.status::text           is distinct from p_from_pay_status
     or v_pay.status::text <> 'submitted' then
    raise exception 'state changed' using errcode = 'P0409';
  end if;
  update public.appointments set payment_status = 'verified', appointment_status = 'payment_verified' where id = p_appointment_id;
  update public.payments set status = 'verified', verified_by = p_actor, verified_at = now() where id = p_payment_id;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'PAYMENT_VERIFIED', p_from_appt_status, 'payment_verified', '{}'::jsonb);
  insert into public.audit_logs (actor_user_id, action, entity, entity_id, changes)
    values (p_actor, 'PAYMENT_VERIFIED', 'payment', p_payment_id, '{}'::jsonb);
end $$;

create or replace function public.payment_reject(
  p_appointment_id uuid, p_payment_id uuid, p_actor uuid, p_reason text,
  p_from_appt_status text, p_from_appt_pay_status text, p_from_pay_status text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_appt public.appointments%rowtype; v_pay public.payments%rowtype;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 300 then
    raise exception 'invalid reason' using errcode = 'P0422';
  end if;
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0404'; end if;
  select * into v_pay from public.payments where id = p_payment_id and appointment_id = p_appointment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0404'; end if;
  if v_appt.appointment_status::text is distinct from p_from_appt_status
     or v_appt.payment_status::text  is distinct from p_from_appt_pay_status
     or v_pay.status::text           is distinct from p_from_pay_status
     or v_pay.status::text <> 'submitted' then
    raise exception 'state changed' using errcode = 'P0409';
  end if;
  -- appointment returns to 'pending' so the user can upload a new screenshot
  update public.appointments set payment_status = 'rejected', appointment_status = 'pending' where id = p_appointment_id;
  update public.payments set status = 'rejected', rejection_reason = p_reason, verified_by = p_actor, verified_at = now() where id = p_payment_id;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'PAYMENT_REJECTED', p_from_appt_status, 'pending', jsonb_build_object('reason', p_reason));
  insert into public.audit_logs (actor_user_id, action, entity, entity_id, changes)
    values (p_actor, 'PAYMENT_REJECTED', 'payment', p_payment_id, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.cancel_appointment(
  p_appointment_id uuid, p_actor uuid, p_by text, p_from_status text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_appt public.appointments%rowtype;
begin
  if p_by not in ('user', 'admin') then raise exception 'invalid actor type' using errcode = 'P0422'; end if;
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0404'; end if;
  if p_by = 'user' and v_appt.user_id is distinct from p_actor then raise exception 'not found' using errcode = 'P0404'; end if;
  if v_appt.appointment_status::text is distinct from p_from_status then raise exception 'state changed' using errcode = 'P0409'; end if;
  if p_by = 'admin' then
    update public.appointments set appointment_status = 'cancelled', cancelled_by = 'cancelled_by_admin', cancelled_at = now() where id = p_appointment_id;
  else
    update public.appointments set appointment_status = 'cancelled', cancelled_by = 'cancelled_by_user',  cancelled_at = now() where id = p_appointment_id;
  end if;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'CANCELLED', p_from_status, 'cancelled', jsonb_build_object('by', p_by));
  insert into public.audit_logs (actor_user_id, action, entity, entity_id, changes)
    values (p_actor, 'APPOINTMENT_CANCELLED', 'appointment', p_appointment_id, jsonb_build_object('by', p_by));
end $$;

create or replace function public.reorder_services(p_ids uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'empty' using errcode = 'P0422'; end if;
  if (select count(distinct x) from unnest(p_ids) as x) <> array_length(p_ids, 1) then raise exception 'duplicate ids' using errcode = 'P0422'; end if;
  if (select count(*) from public.services where id = any (p_ids)) <> array_length(p_ids, 1) then raise exception 'unknown service' using errcode = 'P0404'; end if;
  update public.services s set display_order = o.ord
    from unnest(p_ids) with ordinality as o(id, ord) where s.id = o.id;  -- all rows in one statement/transaction
end $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. Hard backstop against slot hoarding under concurrency (the API enforces the configurable, friendlier limit first).
--    Serialised per user with an advisory lock so parallel requests cannot slip past the count.
-- ───────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_unpaid_appointment_cap() returns trigger
language plpgsql security invoker set search_path = public as $$
declare v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select count(*) into v_count from public.appointments
   where user_id = new.user_id and appointment_status::text in ('pending', 'payment_submitted') and appointment_date >= current_date - 1;
  if v_count >= 10 then
    raise exception 'You have too many unpaid appointment requests. Please pay, wait for confirmation, or cancel one first.' using errcode = 'P0429';
  end if;
  return new;
end $$;
drop trigger if exists trg_unpaid_appointment_cap on public.appointments;
create trigger trg_unpaid_appointment_cap before insert on public.appointments
  for each row execute function public.enforce_unpaid_appointment_cap();

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. RPC execute privileges: only the server (service_role) may call the business functions.
--    Otherwise any logged-in user could call e.g. book_appointment(p_user_id => <someone else>) via PostgREST and bypass the API.
--    Looked up dynamically so it works whatever the existing signatures are. public.is_admin() is deliberately untouched (used by RLS).
-- ───────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('book_appointment', 'block_slot', 'payment_submit_proof', 'payment_verify', 'payment_reject', 'cancel_appointment', 'reorder_services')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant  execute on function %s to service_role', r.sig);
  end loop;
end $$;