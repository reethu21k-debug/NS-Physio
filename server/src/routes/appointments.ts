import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, fromDbError } from '../lib/errors.js';
import { ok } from '../middleware/error.js';
import { bookingSchema, slotsQuery, uuid } from '../lib/schemas.js';
import { APPT_SELECT, type ApptRow, emailData, fromRpcError, getSettings, loadAppointment, publicAppt } from '../lib/helpers.js';
import { computeAvailability, isValidSlotStart } from '../lib/slots.js';
import { canPayOnline } from '../lib/pricing.js';
import { nowInZone } from '../lib/time.js';
import { checkCancellation } from '../lib/cancellation.js';
import { sendEmail, templates } from '../lib/email.js';

const intEnv = (name: string, fallback: number): number => {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};
/** Caps upcoming live bookings per account (any status that still holds a slot). Override with MAX_LIVE_APPOINTMENTS. */
const MAX_LIVE_APPOINTMENTS = intEnv('MAX_LIVE_APPOINTMENTS', 5);
/**
 * Caps upcoming UNPAID/unconfirmed requests (status pending or payment_submitted) so an account cannot hoard slots with
 * requests nobody has paid for or confirmed. Paid/confirmed/completed/cancelled appointments do not count.
 * Override with MAX_UNPAID_APPOINTMENTS. (The DB trigger in 0004_hardening.sql enforces a hard backstop of 10.)
 */
const MAX_UNPAID_APPOINTMENTS = intEnv('MAX_UNPAID_APPOINTMENTS', 3);
const UNPAID = new Set(['pending', 'payment_submitted']);

export const appointments = Router();
appointments.use(requireAuth);

async function serviceDuration(serviceId?: string, fallback = 30): Promise<number> {
  if (!serviceId) return fallback;
  const { data } = await supabase.from('services').select('duration_minutes,is_active').eq('id', serviceId).maybeSingle();
  if (!data || !data.is_active) throw new HttpError(400, 'This service is not available.');
  return data.duration_minutes as number;
}

appointments.get('/available-slots', async (req, res) => {
  const q = slotsQuery.parse(req.query);
  const s = await getSettings();
  const duration = await serviceDuration(q.service_id, s.slot_duration);
  const [{ data: booked }, { data: blocked }] = await Promise.all([
    supabase.from('appointments').select('start_time,end_time').eq('appointment_date', q.date).not('appointment_status', 'in', '(cancelled,rejected)'),
    supabase.from('blocked_slots').select('is_full_day,start_time,end_time').eq('appointment_date', q.date),
  ]);
  const norm = (t: string | null) => (t ? t.slice(0, 5) : null);
  ok(res, computeAvailability(q.date, s,
    (booked ?? []).map((b) => ({ start_time: norm(b.start_time)!, end_time: norm(b.end_time)! })),
    (blocked ?? []).map((b) => ({ is_full_day: b.is_full_day, start_time: norm(b.start_time), end_time: norm(b.end_time) })), duration));
});

appointments.post('/', async (req, res) => {
  const body = bookingSchema.parse(req.body);
  const s = await getSettings();
  const { data: svc } = await supabase.from('services').select('pricing_type,price,duration_minutes,is_active').eq('id', body.service_id).maybeSingle();
  if (!svc || !svc.is_active) throw new HttpError(400, 'This service is not available.');
  if (body.payment_method === 'online' && !canPayOnline(svc)) throw new HttpError(400, 'Online payment is not available for this service. Please pay at the clinic.');
  if (!isValidSlotStart(body.start_time, s, svc.duration_minutes)) throw new HttpError(400, 'That time is outside clinic hours or not a valid slot.');

  // Bounded: only this user's upcoming, slot-holding rows, status column only.
  const { data: live, error: liveErr } = await supabase.from('appointments').select('appointment_status')
    .eq('user_id', req.user!.id).in('appointment_status', ['pending', 'payment_submitted', 'payment_verified', 'confirmed'])
    .gte('appointment_date', nowInZone(s.timezone).date).limit(200);
  if (liveErr) throw fromDbError(liveErr);
  const unpaidCount = (live ?? []).filter((r) => UNPAID.has(r.appointment_status as string)).length;
  if (unpaidCount >= MAX_UNPAID_APPOINTMENTS) {
    throw new HttpError(429, `You already have ${MAX_UNPAID_APPOINTMENTS} unpaid or unconfirmed appointment requests. Please pay, wait for confirmation, or cancel one before booking another.`, 'TOO_MANY_APPOINTMENTS');
  }
  if ((live?.length ?? 0) >= MAX_LIVE_APPOINTMENTS) {
    throw new HttpError(429, `You already have ${MAX_LIVE_APPOINTMENTS} upcoming appointments. Please complete or cancel one before booking another.`, 'TOO_MANY_APPOINTMENTS');
  }

  // Atomic, DB-authoritative booking. Price is derived inside the RPC.
  const { data, error } = await supabase.rpc('book_appointment', {
    p_user_id: req.user!.id, p_service_id: body.service_id, p_date: body.date, p_start: body.start_time,
    p_payment_method: body.payment_method, p_notes: body.notes ?? null,
  });
  if (error) throw fromRpcError(error); // also maps the DB-level backstop (P0429)
  const created = data as { id: string };
  const appt = await loadAppointment(created.id);
  const d = emailData(appt, s);
  if (d) void sendEmail(d.to, templates.requestReceived(d));
  ok(res, publicAppt(appt), 201);
});

appointments.get('/', async (req, res) => {
  const { data, error } = await supabase.from('appointments').select(APPT_SELECT).eq('user_id', req.user!.id)
    .order('appointment_date', { ascending: false }).order('start_time', { ascending: false }).limit(200);
  if (error) throw fromDbError(error);
  ok(res, (data as unknown as ApptRow[]).map(publicAppt));
});

appointments.get('/:id', async (req, res) => {
  const a = await loadAppointment(uuid.parse(req.params.id));
  if (a.user_id !== req.user!.id) throw new HttpError(404, 'Appointment not found.'); // IDOR-safe
  const { data: events } = await supabase.from('appointment_events').select('event_type,new_status,created_at').eq('appointment_id', a.id).order('created_at');
  ok(res, { ...publicAppt(a), events: events ?? [] });
});

appointments.post('/:id/cancel', async (req, res) => {
  const a = await loadAppointment(uuid.parse(req.params.id));
  if (a.user_id !== req.user!.id) throw new HttpError(404, 'Appointment not found.');
  const s = await getSettings();
  const check = checkCancellation(a, s.cancellation_hours, s.timezone, 'user');
  if (!check.allowed) throw new HttpError(400, check.reason!);
  // Atomic: status change + appointment event + audit log (actor = the user, by = 'user') in one transaction,
  // guarded by the status this request observed and by ownership. Any failure aborts all three.
  const { error: cErr } = await supabase.rpc('cancel_appointment', { p_appointment_id: a.id, p_actor: req.user!.id, p_by: 'user', p_from_status: a.appointment_status });
  if (cErr) throw fromRpcError(cErr, 'This appointment was just updated. Please refresh.');
  const d = emailData(a, s);
  if (d) void sendEmail(d.to, templates.cancelled(d));
  ok(res, { id: a.id, appointment_status: 'cancelled' });
});