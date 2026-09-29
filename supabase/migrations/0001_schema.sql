-- NS Physio Clinic: core schema
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ───────── profiles ─────────
create table public.profiles (
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

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role is NEVER read from client-supplied metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          new.email,
          new.raw_user_meta_data->>'phone');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- Block privilege escalation from any client session. SQL editor / service role
-- have auth.uid() = null and can still promote the first admin.
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

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ───────── services ─────────
create table public.services (
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
create trigger services_updated before update on public.services
  for each row execute function public.set_updated_at();
create index services_active_order_idx on public.services (is_active, display_order);

-- ───────── clinic_settings (singleton) ─────────
create table public.clinic_settings (
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
create trigger settings_updated before update on public.clinic_settings
  for each row execute function public.set_updated_at();

-- ───────── appointments ─────────
create table public.appointments (
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
  -- DATABASE-LEVEL DOUBLE-BOOKING GUARD (single-practitioner clinic):
  -- no two live appointments may overlap in time.
  constraint appt_no_overlap exclude using gist (
    tsrange((appointment_date + start_time), (appointment_date + end_time)) with &&
  ) where (appointment_status not in ('cancelled','rejected'))
);
create trigger appointments_updated before update on public.appointments
  for each row execute function public.set_updated_at();
create index appointments_date_idx on public.appointments (appointment_date);
create index appointments_user_idx on public.appointments (user_id);
create index appointments_service_idx on public.appointments (service_id);
create index appointments_status_idx on public.appointments (appointment_status);
create index appointments_payment_status_idx on public.appointments (payment_status);

-- ───────── payments ─────────
create table public.payments (
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
create trigger payments_updated before update on public.payments
  for each row execute function public.set_updated_at();
create index payments_user_idx on public.payments (user_id);
create index payments_status_idx on public.payments (status);

-- ───────── blocked_slots ─────────
create table public.blocked_slots (
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
create index blocked_slots_date_idx on public.blocked_slots (appointment_date);

-- ───────── audit ─────────
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  old_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index appointment_events_appt_idx on public.appointment_events (appointment_id, created_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, created_at desc);
