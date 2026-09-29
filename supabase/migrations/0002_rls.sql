-- Row Level Security. The Express API uses the service-role key (bypasses RLS) and
-- enforces its own authorisation; these policies protect direct PostgREST access.
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.appointment_events enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- (role/email/is_active changes are additionally blocked by trigger protect_profile_fields)

-- services: anyone may read active services; only admins write
create policy services_public_read on public.services for select to anon, authenticated
  using (is_active or public.is_admin());
create policy services_admin_write on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- settings: authenticated read (contains UPI id); admin write. Public site reads via API.
create policy settings_read on public.clinic_settings for select to authenticated using (true);
create policy settings_admin_write on public.clinic_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- appointments: read own; NO insert/update/delete for clients (booking = RPC via API only)
create policy appts_select_own on public.appointments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy appts_admin_update on public.appointments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payments: read own; admins read/update. Clients never write directly.
create policy payments_select_own on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy payments_admin_update on public.payments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- blocked slots: admin only (availability is computed server-side)
create policy blocked_admin_all on public.blocked_slots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- events: user reads own appointment's events; admin all
create policy events_select on public.appointment_events for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.appointments a where a.id = appointment_id and a.user_id = auth.uid()));

-- audit logs: admin read only
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
