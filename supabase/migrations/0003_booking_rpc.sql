-- Atomic booking. Callable ONLY by the service role (the API), which passes the
-- authenticated user id. Price is read from services here - never from the client.
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

revoke all on function public.book_appointment(uuid,uuid,date,time,text,text) from public, anon, authenticated;
grant execute on function public.book_appointment(uuid,uuid,date,time,text,text) to service_role;

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
revoke all on function public.block_slot(uuid,date,boolean,time,time,text,text) from public, anon, authenticated;
grant execute on function public.block_slot(uuid,date,boolean,time,time,text,text) to service_role;
