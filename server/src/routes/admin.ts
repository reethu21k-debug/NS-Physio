import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError, fromDbError } from '../lib/errors.js';
import { ok } from '../middleware/error.js';
import { blockSchema, slotsQuery, usersQuery, uuid } from '../lib/schemas.js';
import { adminListQuery, priceUpdateSchema, revenueQuery } from '../lib/adminSchemas.js';
import { type ApptRow, CUSTOMER_EMBED, SERVICE_EMBED, adminPayment, audit, emailData, fromRpcError, getSettings, loadAppointment, logEvent, onePayment, updateAppointment } from '../lib/helpers.js';
import { canCancel, canComplete, canConfirm, canRejectPayment, canVerifyPayment } from '../lib/status.js';
import { checkCancellation } from '../lib/cancellation.js';
import { sendEmail, templates } from '../lib/email.js';
import { nowInZone } from '../lib/time.js';
import { computeAvailability } from '../lib/slots.js';
import { proofRouter } from './proof.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.use(proofRouter);

/** Statuses that count as revenue (keep in sync with monthly_revenue() in 0005): money received or booking confirmed. */
const REVENUE_STATUSES = ['payment_verified', 'confirmed', 'completed'];
/** First day of month index `m` (0-based, may overflow/underflow) as YYYY-MM-DD. */
const ymd = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
const ym = (date: string) => { const [y = 0, m = 1] = date.split('-').map(Number); return { y, m }; };

/** approve = online payment submitted: verify + confirm in one click. confirm = ready to confirm now. */
const actions = (a: ApptRow) => ({
  verify_payment: canVerifyPayment(a), reject_payment: canRejectPayment(a), confirm: canConfirm(a),
  approve: canVerifyPayment(a) && a.appointment_status === 'payment_submitted',
  cancel: canCancel(a), complete: canComplete(a),
});

adminRouter.get('/appointments', async (req, res) => {
  const f = adminListQuery.parse(req.query);
  let q = supabase.from('appointments').select(`*, ${SERVICE_EMBED}(name), ${CUSTOMER_EMBED}!inner(full_name,email,phone)`, { count: 'exact' });
  if (f.date) q = q.eq('appointment_date', f.date);
  if (f.service_id) q = q.eq('service_id', f.service_id);
  if (f.payment_status) q = q.eq('payment_status', f.payment_status);
  if (f.appointment_status) q = q.eq('appointment_status', f.appointment_status);
  if (f.q) {
    const term = f.q.replace(/[,()%*\\]/g, '');
    if (uuid.safeParse(term).success) q = q.eq('id', term);
    else if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`, { referencedTable: 'customer' });
  }
  const asc = f.sort === 'asc';
  const ordered = f.sort_by === 'created'
    ? q.order('created_at', { ascending: asc })
    : q.order('appointment_date', { ascending: asc }).order('start_time', { ascending: asc });
  const from = (f.page - 1) * f.page_size;
  const { data, error, count } = await ordered.range(from, from + f.page_size - 1);
  if (error) throw fromDbError(error);
  const items = ((data ?? []) as unknown as ApptRow[]).map((a) => ({ ...a, actions: actions(a) }));
  ok(res, { items, total: count ?? 0, page: f.page, page_size: f.page_size });
});

adminRouter.get('/appointments/:id', async (req, res) => {
  const a = await loadAppointment(uuid.parse(req.params.id));
  const { data: events, error: evErr } = await supabase.from('appointment_events').select('*').eq('appointment_id', a.id).order('created_at').limit(500);
  if (evErr) throw fromDbError(evErr);
  const { payment: _payment, ...rest } = a;
  const p = onePayment(a);
  ok(res, { ...rest, payment: p && adminPayment(p), events: events ?? [], actions: actions(a) });
});

/**
 * Confirm / approve. For an online booking whose payment proof was submitted, the payment is verified first (atomic RPC,
 * valid transition payment_submitted -> payment_verified) and then confirmed (payment_verified -> confirmed).
 * If the second step fails, the booking is safely left at payment_verified and can be confirmed again.
 */
adminRouter.post('/appointments/:id/confirm', async (req, res) => {
  let a = await loadAppointment(uuid.parse(req.params.id));
  if (canVerifyPayment(a) && a.appointment_status === 'payment_submitted') {
    const pay = onePayment(a);
    if (!pay) throw new HttpError(404, 'Payment record not found.');
    const { error } = await supabase.rpc('payment_verify', {
      p_appointment_id: a.id, p_payment_id: pay.id, p_actor: req.user!.id,
      p_from_appt_status: a.appointment_status, p_from_appt_pay_status: a.payment_status, p_from_pay_status: pay.status,
    });
    if (error) throw fromRpcError(error, 'This payment was just updated by someone else. Please refresh.');
    a = await loadAppointment(a.id);
  }
  if (!canConfirm(a)) throw new HttpError(400, a.payment_method === 'online' ? 'The customer has not submitted a payment screenshot yet.' : 'This appointment cannot be confirmed.');
  await updateAppointment(a.id, [a.appointment_status], { appointment_status: 'confirmed' });
  await logEvent(a.id, req.user!.id, 'CONFIRMED', a.appointment_status, 'confirmed');
  await audit(req.user!.id, 'APPOINTMENT_CONFIRMED', 'appointment', a.id);
  const d = emailData(a, await getSettings());
  if (d) void sendEmail(d.to, templates.confirmed({ ...d, status: 'confirmed' }));
  ok(res, { appointment_status: 'confirmed', payment_status: a.payment_status });
});

adminRouter.post('/appointments/:id/cancel', async (req, res) => {
  const a = await loadAppointment(uuid.parse(req.params.id));
  const s = await getSettings();
  const c = checkCancellation(a, s.cancellation_hours, s.timezone, 'admin');
  if (!c.allowed) throw new HttpError(400, c.reason!);
  // Atomic: status change + appointment event + audit log in one transaction, guarded by the observed status.
  const { error: cErr } = await supabase.rpc('cancel_appointment', { p_appointment_id: a.id, p_actor: req.user!.id, p_by: 'admin', p_from_status: a.appointment_status });
  if (cErr) throw fromRpcError(cErr, 'This appointment was just updated by someone else. Please refresh.');
  const d = emailData(a, s);
  if (d) void sendEmail(d.to, templates.cancelled(d));
  ok(res, { appointment_status: 'cancelled' });
});

adminRouter.post('/appointments/:id/complete', async (req, res) => {
  const a = await loadAppointment(uuid.parse(req.params.id));
  if (!canComplete(a)) throw new HttpError(400, 'Only confirmed appointments can be marked completed.');
  const s = await getSettings();
  if (a.appointment_date > nowInZone(s.timezone).date) throw new HttpError(400, 'A future appointment cannot be marked completed.');
  await updateAppointment(a.id, ['confirmed'], { appointment_status: 'completed' });
  await logEvent(a.id, req.user!.id, 'COMPLETED', 'confirmed', 'completed');
  await audit(req.user!.id, 'APPOINTMENT_COMPLETED', 'appointment', a.id);
  ok(res, { appointment_status: 'completed' });
});

adminRouter.get('/users', async (req, res) => {
  // Count is aggregated by the database (PostgREST embedded count): no appointment rows are loaded into memory.
  const f = usersQuery.parse(req.query);
  const from = (f.page - 1) * f.page_size;
  const { data, error } = await supabase.from('profiles')
    .select('id,full_name,email,phone,role,is_active,created_at,appointments!appointments_user_id_fkey(count)')
    .order('created_at', { ascending: false }).order('id').range(from, from + f.page_size - 1);
  if (error) throw fromDbError(error);
  type Row = Record<string, unknown> & { appointments?: { count: number }[] | null };
  ok(res, ((data ?? []) as unknown as Row[]).map(({ appointments: ap, ...u }) => ({ ...u, appointment_count: Number(ap?.[0]?.count ?? 0) })));
});

// ───── revenue ─────
adminRouter.get('/revenue', async (req, res) => {
  const { months } = revenueQuery.parse(req.query);
  const s = await getSettings();
  const { y, m } = ym(nowInZone(s.timezone).date);
  const { data, error } = await supabase.rpc('monthly_revenue', { p_from: ymd(y, m - months), p_to: ymd(y, m) });
  if (error) throw fromDbError(error);
  const byMonth = new Map(((data ?? []) as { month: string; revenue: number | string; bookings: number | string }[]).map((r) => [r.month, r]));
  const rows = Array.from({ length: months }, (_, i) => {
    const key = ymd(y, m - months + i).slice(0, 7);
    const r = byMonth.get(key);
    return { month: key, revenue: Number(r?.revenue ?? 0), bookings: Number(r?.bookings ?? 0) };
  });
  ok(res, {
    statuses: REVENUE_STATUSES, months: rows,
    total: rows.reduce((n, r) => n + r.revenue, 0), bookings: rows.reduce((n, r) => n + r.bookings, 0),
  });
});

adminRouter.get('/dashboard', async (_req, res) => {
  const s = await getSettings();
  const today = nowInZone(s.timezone).date;
  const { y, m } = ym(today);
  const tomorrow = new Date(Date.UTC(y, m - 1, Number(today.slice(8, 10)) + 1)).toISOString().slice(0, 10);
  const count = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => (await build(base())).count ?? 0;
  const base = () => supabase.from('appointments').select('id', { count: 'exact', head: true });
  const [todayC, pending, verifyC, confirmed, completed, cancelled, todayRev, monthRev, upcoming, recent] = await Promise.all([
    count((q) => q.eq('appointment_date', today).in('appointment_status', ['pending', 'payment_submitted', 'payment_verified', 'confirmed', 'completed'])),
    count((q) => q.eq('appointment_status', 'pending')),
    count((q) => q.eq('payment_status', 'submitted').not('appointment_status', 'in', '(cancelled,rejected)')),
    count((q) => q.eq('appointment_status', 'confirmed').gte('appointment_date', today)),
    count((q) => q.eq('appointment_status', 'completed')),
    count((q) => q.eq('appointment_status', 'cancelled')),
    supabase.rpc('monthly_revenue', { p_from: today, p_to: tomorrow }),
    supabase.rpc('monthly_revenue', { p_from: ymd(y, m - 1), p_to: ymd(y, m) }),
    supabase.from('appointments').select(`id,appointment_date,start_time,appointment_status,${SERVICE_EMBED}(name),${CUSTOMER_EMBED}(full_name)`)
      .gte('appointment_date', today).not('appointment_status', 'in', '(cancelled,rejected,completed)')
      .order('appointment_date').order('start_time').limit(8),
    supabase.from('appointments').select(`id,created_at,appointment_date,start_time,appointment_status,payment_status,payment_method,amount,${SERVICE_EMBED}(name),${CUSTOMER_EMBED}(full_name)`)
      .order('created_at', { ascending: false }).limit(8),
  ]);
  for (const r of [todayRev, monthRev, upcoming, recent]) if (r.error) throw fromDbError(r.error);
  const sum = (rows: unknown) => ((rows as { revenue: number | string }[] | null) ?? []).reduce((n, r) => n + Number(r.revenue), 0);
  ok(res, {
    today, today_appointments: todayC, pending, pending_payment_verification: verifyC, confirmed, completed, cancelled,
    today_revenue: sum(todayRev.data), month_revenue: sum(monthRev.data), upcoming: upcoming.data ?? [], recent: recent.data ?? [],
  });
});

// ───── service prices (bulk, atomic, audited; the server prices every booking from this table) ─────
adminRouter.patch('/service-prices', async (req, res) => {
  const { items } = priceUpdateSchema.parse(req.body);
  const payload = items.map((i) => ({ id: i.id, pricing_type: i.pricing_type, price: i.price ?? null }));
  const { data, error } = await supabase.rpc('update_service_prices', { p_actor: req.user!.id, p_items: payload });
  if (error) throw fromRpcError(error);
  ok(res, { updated: Number(data ?? 0) });
});

// ───── time slots ─────
adminRouter.get('/slots', async (req, res) => {
  const q = slotsQuery.parse(req.query);
  const s = await getSettings();
  const [{ data: booked }, { data: blocks }] = await Promise.all([
    supabase.from('appointments').select(`id,start_time,end_time,appointment_status,${CUSTOMER_EMBED}(full_name)`).eq('appointment_date', q.date).not('appointment_status', 'in', '(cancelled,rejected)'),
    supabase.from('blocked_slots').select('*').eq('appointment_date', q.date).order('start_time'),
  ]);
  const n = (t: string | null) => (t ? t.slice(0, 5) : null);
  const avail = computeAvailability(q.date, s,
    (booked ?? []).map((b) => ({ start_time: n(b.start_time)!, end_time: n(b.end_time)! })),
    (blocks ?? []).map((b) => ({ is_full_day: b.is_full_day, start_time: n(b.start_time), end_time: n(b.end_time) })));
  ok(res, { ...avail, appointments: booked ?? [], blocks: blocks ?? [] });
});

adminRouter.post('/slots/block', async (req, res) => {
  const v = blockSchema.parse(req.body);
  const { data, error } = await supabase.rpc('block_slot', {
    p_admin: req.user!.id, p_date: v.date, p_full_day: v.full_day, p_start: v.start_time ?? null, p_end: v.end_time ?? null,
    p_reason: v.reason, p_note: v.note ?? null,
  });
  if (error) throw fromDbError(error);
  await audit(req.user!.id, 'SLOT_BLOCKED', 'blocked_slot', (data as { id: string }).id, v);
  ok(res, data, 201);
});

adminRouter.delete('/slots/block/:id', async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { error } = await supabase.from('blocked_slots').delete().eq('id', id);
  if (error) throw fromDbError(error);
  await audit(req.user!.id, 'SLOT_UNBLOCKED', 'blocked_slot', id);
  ok(res, { id });
});