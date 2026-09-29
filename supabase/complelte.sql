-- =====================================================================================================================
-- NS Physio Clinic — COMPLETE DATABASE SETUP (single file for the Supabase SQL Editor)
-- Combines: 0001_schema + 0002_rls (admin-write policies removed) + 0003_booking_rpc + 0004_hardening + seed.
-- Safe on a fresh database AND safe to re-run (idempotent: nothing is dropped except old triggers/policies that are re-created).
-- Architecture: the Express API uses the service_role key (bypasses RLS) and is the ONLY writer of business data.
-- =====================================================================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ═════════════════════════════════════════════ 1. SCHEMA ═════════════════════════════════════════════

-- ───────── profiles ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  role text not null default 'user' check (role in ('user','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role is NEVER read from client-supplied metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.email,''),
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- Block privilege escalation from any client session. SQL editor / service role have auth.uid() = null
-- and can still promote the first admin.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role
       or new.email is distinct from old.email
       or new.is_active is distinct from old.is_active
       or new.id is distinct from old.id then
      raise exception 'Not allowed to change protected profile fields';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Users who signed up before this script ran (no trigger yet) get a profile; existing rows are untouched.
insert into public.profiles (id, full_name, email, phone)
select u.id, coalesce(u.raw_user_meta_data->>'full_name',''), coalesce(u.email,''), u.raw_user_meta_data->>'phone'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ───────── services ─────────
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  pricing_type text not null check (pricing_type in ('fixed','starting_from','contact')),
  price numeric(10,2),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  image_url text,
  cloudinary_public_id text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_price_rule check (
    (pricing_type = 'contact' and (price is null or price > 0))
    or (pricing_type in ('fixed','starting_from') and price is not null and price > 0)
  )
);
drop trigger if exists services_updated on public.services;
create trigger services_updated before update on public.services
  for each row execute function public.set_updated_at();
create index if not exists services_active_order_idx on public.services (is_active, display_order);

-- ───────── clinic_settings (singleton) ─────────
create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  clinic_name text not null default 'NS Physio Clinic',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  about_text text not null default '',
  morning_start time not null default '09:00',
  morning_end time not null default '13:00',
  evening_start time not null default '16:00',
  evening_end time not null default '21:00',
  slot_duration integer not null default 30 check (slot_duration between 5 and 240),
  timezone text not null default 'Asia/Kolkata',
  booking_window_days integer not null default 60 check (booking_window_days between 1 and 365),
  upi_id text not null default '',
  upi_qr_url text,
  upi_qr_cloudinary_public_id text,
  cancellation_hours integer not null default 4 check (cancellation_hours >= 0),
  updated_at timestamptz not null default now()
);
drop trigger if exists settings_updated on public.clinic_settings;
create trigger settings_updated before update on public.clinic_settings
  for each row execute function public.set_updated_at();

-- ───────── appointments ─────────
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  -- NULL amount = price to be confirmed at the clinic (contact-pricing services). Never 0.
  amount numeric(10,2) check (amount is null or amount > 0),
  payment_method text not null check (payment_method in ('offline','online')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','submitted','verified','rejected')),
  appointment_status text not null default 'pending'
    check (appointment_status in ('pending','payment_submitted','payment_verified','confirmed','rejected','cancelled','completed')),
  notes text,
  cancelled_by text check (cancelled_by in ('cancelled_by_user','cancelled_by_admin')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appt_time_order check (end_time > start_time),
  constraint appt_cancel_consistency check ((appointment_status = 'cancelled') = (cancelled_by is not null)),
  -- DATABASE-LEVEL DOUBLE-BOOKING GUARD (single-practitioner clinic): no two live appointments may overlap in time.
  constraint appt_no_overlap exclude using gist (
    tsrange((appointment_date + start_time), (appointment_date + end_time)) with &&
  ) where (appointment_status not in ('cancelled','rejected'))
);
drop trigger if exists appointments_updated on public.appointments;
create trigger appointments_updated before update on public.appointments
  for each row execute function public.set_updated_at();
create index if not exists appointments_date_idx on public.appointments (appointment_date);
create index if not exists appointments_user_idx on public.appointments (user_id);
create index if not exists appointments_service_idx on public.appointments (service_id);
create index if not exists appointments_status_idx on public.appointments (appointment_status);
create index if not exists appointments_payment_status_idx on public.appointments (payment_status);

-- ───────── payments ─────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10,2) check (amount is null or amount > 0),
  payment_method text not null check (payment_method in ('offline','online')),
  screenshot_url text,
  cloudinary_public_id text,
  status text not null default 'pending' check (status in ('pending','submitted','verified','rejected')),
  rejection_reason text,
  submitted_at timestamptz,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists payments_updated on public.payments;
create trigger payments_updated before update on public.payments
  for each row execute function public.set_updated_at();
create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);

-- ───────── blocked_slots ─────────
create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  appointment_date date not null,
  is_full_day boolean not null default false,
  start_time time,
  end_time time,
  reason text not null default 'Other',
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint blocked_shape check (
    (is_full_day and start_time is null and end_time is null)
    or (not is_full_day and start_time is not null and end_time is not null and end_time > start_time)
  )
);
create index if not exists blocked_slots_date_idx on public.blocked_slots (appointment_date);

-- ───────── audit ─────────
create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  old_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists appointment_events_appt_idx on public.appointment_events (appointment_id, created_at);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, created_at desc);

-- ═════════════════════════════════════════════ 2. ROW LEVEL SECURITY ═════════════════════════════════════════════
-- Read-only policies for the DB API. There are NO admin write policies: writes happen only through the server (service_role).

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.appointment_events enable row level security;
alter table public.audit_logs enable row level security;

-- Remove every policy from earlier versions (incl. the old admin-write ones) so nothing overlaps or lingers.
drop policy if exists profiles_select_own     on public.profiles;
drop policy if exists profiles_update_own     on public.profiles;
drop policy if exists services_public_read    on public.services;
drop policy if exists services_admin_write    on public.services;
drop policy if exists settings_read           on public.clinic_settings;
drop policy if exists settings_admin_write    on public.clinic_settings;
drop policy if exists appts_select_own        on public.appointments;
drop policy if exists appts_admin_update      on public.appointments;
drop policy if exists payments_select_own     on public.payments;
drop policy if exists payments_admin_update   on public.payments;
drop policy if exists blocked_admin_all       on public.blocked_slots;
drop policy if exists blocked_admin_read      on public.blocked_slots;
drop policy if exists events_select           on public.appointment_events;
drop policy if exists audit_admin_read        on public.audit_logs;

-- profiles: read own (admins read all); users may edit only their own row (column list is further limited by GRANT below)
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- services: anyone may read active services (admins read all)
create policy services_public_read on public.services for select to anon, authenticated
  using (is_active or public.is_admin());

-- settings: authenticated read (contains UPI id)
create policy settings_read on public.clinic_settings for select to authenticated using (true);

-- appointments / payments: read own (admins read all)
create policy appts_select_own on public.appointments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy payments_select_own on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- blocked slots: admin read only (availability is computed server-side)
create policy blocked_admin_read on public.blocked_slots for select to authenticated
  using (public.is_admin());

-- events: user reads own appointment's events; admin all
create policy events_select on public.appointment_events for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.appointments a where a.id = appointment_id and a.user_id = auth.uid()));

-- audit logs: admin read only
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- ═════════════════════════════════════════════ 3. TABLE PRIVILEGES (defence in depth) ═════════════════════════════════════════════
-- Even if a permissive policy is added by mistake later, anon/authenticated still cannot write. service_role is unaffected.

revoke all on public.profiles, public.clinic_settings, public.appointments, public.payments,
              public.blocked_slots, public.appointment_events, public.audit_logs from anon;
revoke all on public.services from anon;
grant  select on public.services to anon;                         -- public service list

revoke insert, update, delete, truncate, references, trigger on
  public.services, public.clinic_settings, public.appointments, public.payments,
  public.blocked_slots, public.appointment_events, public.audit_logs from authenticated;

-- profiles: users may edit only name/phone; role/email/is_active can never be targeted; rows come from the auth trigger only
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;

-- payments: proof pointers (screenshot_url, cloudinary_public_id) and verified_by are not readable through the DB API.
-- Proofs are only delivered by the server as signed URLs after an authorisation check.
revoke select on public.payments from authenticated;
grant  select (id, appointment_id, user_id, amount, payment_method, status, rejection_reason, submitted_at, verified_at)
  on public.payments to authenticated;

-- ═════════════════════════════════════════════ 4. BOOKING RPCs (from 0003) ═════════════════════════════════════════════

create or replace function public.book_appointment(
  p_user_id uuid,
  p_service_id uuid,
  p_date date,
  p_start time,
  p_payment_method text,
  p_notes text default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  s public.clinic_settings;
  svc public.services;
  v_end time;
  v_now_local timestamp;
  v_amount numeric(10,2);
  v_ok boolean := false;
  v_offset_min integer;
  appt public.appointments;
begin
  if p_payment_method not in ('offline','online') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if not exists (select 1 from profiles where id = p_user_id and is_active) then
    raise exception 'USER_NOT_ALLOWED';
  end if;

  select * into s from clinic_settings limit 1;
  select * into svc from services where id = p_service_id;
  if not found or not svc.is_active then raise exception 'SERVICE_UNAVAILABLE'; end if;

  -- Server-side price. Contact-pricing services have no amount and cannot be paid online.
  if svc.pricing_type = 'contact' then
    if p_payment_method = 'online' then raise exception 'ONLINE_NOT_ALLOWED_FOR_CONTACT'; end if;
    v_amount := null;
  else
    v_amount := svc.price;
  end if;

  v_now_local := now() at time zone s.timezone;
  if p_date < v_now_local::date then raise exception 'PAST_DATE'; end if;
  if p_date > v_now_local::date + s.booking_window_days then raise exception 'BEYOND_BOOKING_WINDOW'; end if;
  if p_date = v_now_local::date and p_start <= v_now_local::time then raise exception 'PAST_TIME'; end if;

  v_end := p_start + make_interval(mins => svc.duration_minutes);
  if v_end <= p_start then raise exception 'INVALID_SLOT'; end if; -- crossed midnight

  -- Must sit on the slot grid and fit entirely inside one operating window.
  v_offset_min := (extract(epoch from (p_start - s.morning_start)) / 60)::int;
  if p_start >= s.morning_start and v_end <= s.morning_end and v_offset_min % s.slot_duration = 0 then v_ok := true; end if;
  v_offset_min := (extract(epoch from (p_start - s.evening_start)) / 60)::int;
  if p_start >= s.evening_start and v_end <= s.evening_end and v_offset_min % s.slot_duration = 0 then v_ok := true; end if;
  if not v_ok then raise exception 'INVALID_SLOT'; end if;

  -- Serialise bookings/blocks for the same day, then check blocks.
  perform pg_advisory_xact_lock(hashtext('ns-physio:' || p_date::text));
  if exists (
    select 1 from blocked_slots b
    where b.appointment_date = p_date
      and (b.is_full_day or (b.start_time < v_end and b.end_time > p_start))
  ) then raise exception 'SLOT_BLOCKED'; end if;

  begin
    insert into appointments (user_id, service_id, appointment_date, start_time, end_time,
                              amount, payment_method, notes)
    values (p_user_id, p_service_id, p_date, p_start, v_end, v_amount, p_payment_method, p_notes)
    returning * into appt;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';   -- DB exclusion constraint is the final authority
  end;

  insert into payments (appointment_id, user_id, amount, payment_method)
  values (appt.id, p_user_id, v_amount, p_payment_method);

  insert into appointment_events (appointment_id, actor_user_id, event_type, new_status, metadata)
  values (appt.id, p_user_id, 'BOOKED', appt.appointment_status,
          jsonb_build_object('payment_method', p_payment_method, 'amount', v_amount));

  return appt;
end $$;

-- Admin blocks: same advisory lock; refuses to block a slot that already has a live appointment.
create or replace function public.block_slot(
  p_admin uuid, p_date date, p_full_day boolean, p_start time, p_end time, p_reason text, p_note text
) returns public.blocked_slots
language plpgsql security definer set search_path = public as $$
declare b public.blocked_slots;
begin
  perform pg_advisory_xact_lock(hashtext('ns-physio:' || p_date::text));
  if exists (
    select 1 from appointments a
    where a.appointment_date = p_date and a.appointment_status not in ('cancelled','rejected','completed')
      and (p_full_day or (a.start_time < p_end and a.end_time > p_start))
  ) then raise exception 'HAS_LIVE_APPOINTMENTS'; end if;
  insert into blocked_slots (appointment_date, is_full_day, start_time, end_time, reason, note, created_by)
  values (p_date, p_full_day, case when p_full_day then null else p_start end,
          case when p_full_day then null else p_end end, p_reason, p_note, p_admin)
  returning * into b;
  return b;
end $$;

-- ═════════════════════════════════════════════ 5. ATOMIC, AUDITED TRANSITIONS (from 0004) ═════════════════════════════════════════════
-- Custom SQLSTATEs used by the API: P0404 not found | P0409 state changed (-> HTTP 409) | P0422 invalid input | P0429 limit reached.
-- Each function locks the rows (FOR UPDATE), compares with the state the API observed, updates, and writes event + audit log
-- in ONE transaction. Any failure rolls everything back.

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
  if v_appt.payment_method <> 'online'
     or v_appt.appointment_status is distinct from p_from_appt_status
     or v_appt.payment_status     is distinct from p_from_appt_pay_status
     or v_pay.status              is distinct from p_from_pay_status then
    raise exception 'state changed' using errcode = 'P0409';
  end if;
  update public.appointments set payment_status = 'submitted', appointment_status = 'payment_submitted' where id = p_appointment_id;
  update public.payments set screenshot_url = p_url, cloudinary_public_id = p_public_id, status = 'submitted',
         submitted_at = now(), rejection_reason = null, verified_by = null, verified_at = null where id = p_payment_id;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'PAYMENT_SUBMITTED', p_from_appt_status, 'payment_submitted', '{}'::jsonb);
  return v_pay.cloudinary_public_id;  -- previous proof (captured before the update) for the API to delete after commit
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
  if v_appt.appointment_status is distinct from p_from_appt_status
     or v_appt.payment_status  is distinct from p_from_appt_pay_status
     or v_pay.status           is distinct from p_from_pay_status
     or v_pay.status <> 'submitted' then
    raise exception 'state changed' using errcode = 'P0409';
  end if;
  update public.appointments set payment_status = 'verified', appointment_status = 'payment_verified' where id = p_appointment_id;
  update public.payments set status = 'verified', verified_by = p_actor, verified_at = now() where id = p_payment_id;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'PAYMENT_VERIFIED', p_from_appt_status, 'payment_verified', '{}'::jsonb);
  insert into public.audit_logs (actor_user_id, action, entity, entity_id, changes)
    values (p_actor, 'PAYMENT_VERIFIED', 'payment', p_payment_id::text, '{}'::jsonb);
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
  if v_appt.appointment_status is distinct from p_from_appt_status
     or v_appt.payment_status  is distinct from p_from_appt_pay_status
     or v_pay.status           is distinct from p_from_pay_status
     or v_pay.status <> 'submitted' then
    raise exception 'state changed' using errcode = 'P0409';
  end if;
  -- appointment returns to 'pending' so the user can upload a new screenshot
  update public.appointments set payment_status = 'rejected', appointment_status = 'pending' where id = p_appointment_id;
  update public.payments set status = 'rejected', rejection_reason = p_reason, verified_by = p_actor, verified_at = now() where id = p_payment_id;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'PAYMENT_REJECTED', p_from_appt_status, 'pending', jsonb_build_object('reason', p_reason));
  insert into public.audit_logs (actor_user_id, action, entity, entity_id, changes)
    values (p_actor, 'PAYMENT_REJECTED', 'payment', p_payment_id::text, jsonb_build_object('reason', p_reason));
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
  if v_appt.appointment_status is distinct from p_from_status
     or v_appt.appointment_status in ('cancelled', 'rejected', 'completed') then
    raise exception 'state changed' using errcode = 'P0409';
  end if;
  update public.appointments
     set appointment_status = 'cancelled',
         cancelled_by = case when p_by = 'admin' then 'cancelled_by_admin' else 'cancelled_by_user' end,
         cancelled_at = now()
   where id = p_appointment_id;
  insert into public.appointment_events (appointment_id, actor_user_id, event_type, old_status, new_status, metadata)
    values (p_appointment_id, p_actor, 'CANCELLED', p_from_status, 'cancelled', jsonb_build_object('by', p_by));
  insert into public.audit_logs (actor_user_id, action, entity, entity_id, changes)
    values (p_actor, 'APPOINTMENT_CANCELLED', 'appointment', p_appointment_id::text, jsonb_build_object('by', p_by));
end $$;

create or replace function public.reorder_services(p_ids uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'empty' using errcode = 'P0422'; end if;
  if (select count(distinct x) from unnest(p_ids) as x) <> array_length(p_ids, 1) then raise exception 'duplicate ids' using errcode = 'P0422'; end if;
  if (select count(*) from public.services where id = any (p_ids)) <> array_length(p_ids, 1) then raise exception 'unknown service' using errcode = 'P0404'; end if;
  update public.services s set display_order = o.ord
    from unnest(p_ids) with ordinality as o(id, ord) where s.id = o.id;  -- one statement = all rows or none
end $$;

-- Hard backstop against slot hoarding under concurrency (the API enforces the configurable, friendlier limit first).
-- Serialised per user with an advisory lock so parallel requests cannot slip past the count.
create or replace function public.enforce_unpaid_appointment_cap() returns trigger
language plpgsql security invoker set search_path = public as $$
declare v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select count(*) into v_count from public.appointments
   where user_id = new.user_id and appointment_status in ('pending', 'payment_submitted') and appointment_date >= current_date - 1;
  if v_count >= 10 then
    raise exception 'You have too many unpaid appointment requests. Please pay, wait for confirmation, or cancel one first.' using errcode = 'P0429';
  end if;
  return new;
end $$;
drop trigger if exists trg_unpaid_appointment_cap on public.appointments;
create trigger trg_unpaid_appointment_cap before insert on public.appointments
  for each row execute function public.enforce_unpaid_appointment_cap();

-- ═════════════════════════════════════════════ 6. FUNCTION EXECUTE PRIVILEGES ═════════════════════════════════════════════
-- Only the server (service_role) may call the business functions; otherwise any logged-in user could call
-- book_appointment(p_user_id => <someone else>) through the DB API. public.is_admin() is deliberately untouched (RLS uses it).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('book_appointment', 'block_slot', 'payment_submit_proof', 'payment_verify',
                         'payment_reject', 'cancel_appointment', 'reorder_services')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ═════════════════════════════════════════════ 7. SEED (only if empty) ═════════════════════════════════════════════
insert into public.clinic_settings (singleton) values (true) on conflict (singleton) do nothing;

insert into public.services (name, description, pricing_type, price, duration_minutes, display_order)
select v.name, v.description, v.pricing_type, v.price, v.duration_minutes, v.display_order
from (values
  ('Dry Cupping','A traditional therapy that uses gentle suction cups on the skin to support muscle relaxation and comfort. Suitability is assessed at your visit.','starting_from',299,30,1),
  ('Wet Cupping','A traditional therapy performed by a trained practitioner under hygienic conditions. Suitability is assessed at your visit.','starting_from',799,30,2),
  ('Needling','Targeted needling technique used as part of a physiotherapy treatment plan, performed with sterile single-use needles.','fixed',499,30,3),
  ('Other Therapy','Other physiotherapy and rehabilitation treatments. Contact the clinic to discuss your needs and pricing.','contact',null,30,4)
) as v(name, description, pricing_type, price, duration_minutes, display_order)
where not exists (select 1 from public.services);