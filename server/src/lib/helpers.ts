import { supabase } from './supabase.js';
import { HttpError, fromDbError } from './errors.js';
import { normTime } from './time.js';
import { proofUrl } from './cloudinary.js';
import type { ApptEmailData } from './email.js';
import type { AppointmentStatus } from './status.js';
import type { SettingsForSlots } from './slots.js';

export interface Settings extends SettingsForSlots {
  id: string; clinic_name: string; phone: string; email: string; address: string; about_text: string;
  upi_id: string; upi_qr_url: string | null; upi_qr_cloudinary_public_id: string | null; cancellation_hours: number;
}
export interface PaymentRow {
  id: string; appointment_id: string; user_id: string; amount: number | null; payment_method: 'offline' | 'online';
  screenshot_url: string | null; cloudinary_public_id: string | null; status: 'pending' | 'submitted' | 'verified' | 'rejected';
  rejection_reason: string | null; submitted_at: string | null; verified_at: string | null;
}
export interface ApptRow {
  id: string; user_id: string; service_id: string; appointment_date: string; start_time: string; end_time: string;
  amount: number | null; payment_method: 'offline' | 'online'; payment_status: 'pending' | 'submitted' | 'verified' | 'rejected';
  appointment_status: AppointmentStatus; notes: string | null; cancelled_by: string | null; created_at: string;
  service?: { name: string; duration_minutes: number } | null;
  customer?: { full_name: string; email: string; phone: string | null } | null;
  payment?: PaymentRow | PaymentRow[] | null;
}

/**
 * Explicit FK hints: profiles/payments are reachable from appointments through several paths (user_id, payments.user_id,
 * payments.verified_by, appointment_events.actor_user_id...). Without a hint PostgREST can reject the embed as ambiguous.
 */
export const CUSTOMER_EMBED = 'customer:profiles!appointments_user_id_fkey';
export const SERVICE_EMBED = 'service:services!appointments_service_id_fkey';
export const PAYMENT_EMBED = 'payment:payments!payments_appointment_id_fkey';
export const APPT_SELECT = `*, ${SERVICE_EMBED}(name,duration_minutes), ${CUSTOMER_EMBED}(full_name,email,phone), ${PAYMENT_EMBED}(*)`;

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('clinic_settings').select('*').limit(1).single();
  if (error || !data) throw new HttpError(500, 'Clinic settings are not configured.');
  const s = data as Settings;
  return { ...s, morning_start: normTime(s.morning_start), morning_end: normTime(s.morning_end), evening_start: normTime(s.evening_start), evening_end: normTime(s.evening_end) };
}

export const onePayment = (a: ApptRow): PaymentRow | null => (Array.isArray(a.payment) ? a.payment[0] ?? null : a.payment ?? null);

export async function loadAppointment(id: string): Promise<ApptRow> {
  const { data, error } = await supabase.from('appointments').select(APPT_SELECT).eq('id', id).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, 'Appointment not found.');
  return data as unknown as ApptRow;
}

/** Optimistic state change: only applies if the appointment is still in `from` status. */
export async function updateAppointment(id: string, from: AppointmentStatus[], patch: Record<string, unknown>) {
  const { data, error } = await supabase.from('appointments').update(patch).eq('id', id).in('appointment_status', from).select('id');
  if (error) throw fromDbError(error);
  if (!data?.length) throw new HttpError(409, 'This appointment was just updated by someone else. Please refresh.');
}

export async function logEvent(appointment_id: string, actor: string | null, event_type: string, old_status: string | null, new_status: string | null, metadata: object = {}) {
  const { error } = await supabase.from('appointment_events').insert({ appointment_id, actor_user_id: actor, event_type, old_status, new_status, metadata });
  if (error) {
    // The audit trail must never be silently skipped: surface the failure to the caller.
    console.error('[audit] event log failed', error.message);
    throw new HttpError(500, 'Could not record the appointment history. Please try again.');
  }
}
export async function audit(actor: string, action: string, entity: string, entity_id: string | null, changes: object = {}) {
  const { error } = await supabase.from('audit_logs').insert({ actor_user_id: actor, action, entity, entity_id, changes });
  if (error) {
    console.error('[audit] log failed', error.message);
    throw new HttpError(500, 'Could not record the audit log. Please try again.');
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dateLabel = (d: string) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[(m ?? 1) - 1]} ${y}`; };
export const timeLabel = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const amountLabel = (a: number | null) => (a === null ? 'To be confirmed at clinic' : `₹${Number(a).toLocaleString('en-IN')}`);

export function emailData(a: ApptRow, s: Settings): ApptEmailData | null {
  if (!a.customer) return null;
  return {
    name: a.customer.full_name || 'there', to: a.customer.email, service: a.service?.name ?? 'Appointment',
    dateLabel: dateLabel(a.appointment_date), timeLabel: timeLabel(a.start_time), amountLabel: amountLabel(a.amount),
    paymentLabel: a.payment_method === 'online' ? 'Online Payment' : 'Pay at Clinic',
    status: a.appointment_status.replace(/_/g, ' '),
    clinic: { name: s.clinic_name, phone: s.phone, address: s.address, email: s.email },
  };
}

/** User-facing shape: never leaks admin identifiers. */
export function publicAppt(a: ApptRow) {
  const p = onePayment(a);
  const { customer: _c, payment: _p, ...rest } = a;
  return {
    ...rest,
    payment: p && { id: p.id, status: p.status, screenshot_url: proofUrl(p.cloudinary_public_id), rejection_reason: p.rejection_reason, submitted_at: p.submitted_at },
  };
}

/**
 * Admin-only payment shape: the raw stored URL and Cloudinary public id are never sent; only a signed delivery URL.
 * (Call only from routes guarded by requireAdmin.)
 */
export function adminPayment(p: PaymentRow) {
  const { cloudinary_public_id, ...rest } = p;
  return { ...rest, screenshot_url: proofUrl(cloudinary_public_id) };
}

type DbErr = Parameters<typeof fromDbError>[0];
/**
 * Maps the custom SQLSTATEs raised by the hardening RPCs (0004_hardening.sql) to HTTP errors; anything else goes
 * through fromDbError unchanged.  P0404 not found, P0409 state changed (conflict), P0422 invalid input, P0429 limit reached.
 */
export function fromRpcError(error: DbErr, conflictMessage = 'This record was just updated by someone else. Please refresh.') {
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? '';
  if (code === 'P0409') return new HttpError(409, conflictMessage);
  if (code === 'P0404') return new HttpError(404, 'Record not found.');
  if (code === 'P0422') return new HttpError(400, 'Invalid request.');
  if (code === 'P0429') return new HttpError(429, message || 'Too many pending appointments.', 'TOO_MANY_APPOINTMENTS');
  return fromDbError(error);
}