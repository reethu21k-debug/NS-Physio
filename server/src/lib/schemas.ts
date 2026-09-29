import { z } from 'zod';

export const uuid = z.string().uuid();

/**
 * True only for real calendar dates (rejects 2026-02-31, 2026-13-01, 2025-02-29...).
 * Pure arithmetic: no JavaScript Date parsing, so nothing is silently normalised and no timezone is involved.
 */
export const isRealDate = (s: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1900 || y > 9999 || mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]!;
  return d <= dim;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').refine(isRealDate, 'Invalid date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time');

/** Note: no price/amount/status fields are accepted from the client. */
export const bookingSchema = z.object({
  service_id: uuid, date, start_time: time,
  payment_method: z.enum(['offline', 'online']),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const slotsQuery = z.object({ date, service_id: uuid.optional() });

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''),
  pricing_type: z.enum(['fixed', 'starting_from', 'contact']),
  price: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  is_active: z.boolean().default(true),
  display_order: z.coerce.number().int().min(0).default(0),
}).strict().superRefine((v, ctx) => {
  if (v.pricing_type !== 'contact' && !v.price) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Price is required for fixed and starting-from pricing' });
});

/** PATCH body: every field optional, NO defaults (a partial update never resets other columns). Do not add .default() here. */
export const serviceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  pricing_type: z.enum(['fixed', 'starting_from', 'contact']),
  price: z.coerce.number().positive().max(1_000_000).nullable(),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  is_active: z.boolean(),
  display_order: z.coerce.number().int().min(0),
}).partial().strict();

export const reorderSchema = z.object({
  ids: z.array(uuid).min(1).max(100).refine((a) => new Set(a).size === a.length, 'Duplicate service ids'),
}).strict();

export const settingsSchema = z.object({
  clinic_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30),
  email: z.union([z.string().trim().email(), z.literal('')]),
  address: z.string().trim().max(400),
  about_text: z.string().trim().max(2000),
  morning_start: time, morning_end: time, evening_start: time, evening_end: time,
  slot_duration: z.coerce.number().int().min(5).max(240),
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Invalid timezone'),
  booking_window_days: z.coerce.number().int().min(1).max(365),
  upi_id: z.string().trim().max(80).regex(/^([\w.\-]+@[\w.\-]+)?$/, 'Invalid UPI ID'),
  cancellation_hours: z.coerce.number().int().min(0).max(720),
}).partial().strict().superRefine((v, ctx) => {
  const pairs: [keyof typeof v, keyof typeof v][] = [['morning_start', 'morning_end'], ['evening_start', 'evening_end']];
  for (const [a, b] of pairs) if (v[a] && v[b] && String(v[a]) >= String(v[b])) ctx.addIssue({ code: 'custom', path: [b], message: 'End must be after start' });
  if (v.morning_end && v.evening_start && v.morning_end > v.evening_start) ctx.addIssue({ code: 'custom', path: ['evening_start'], message: 'Evening must start after morning ends' });
});

export const blockSchema = z.object({
  date, full_day: z.boolean().default(false),
  start_time: time.optional(), end_time: time.optional(),
  reason: z.enum(['Doctor unavailable', 'Holiday', 'Maintenance', 'Personal', 'Other']),
  note: z.string().trim().max(300).optional(),
}).strict().superRefine((v, ctx) => {
  if (!v.full_day && (!v.start_time || !v.end_time || v.start_time >= v.end_time))
    ctx.addIssue({ code: 'custom', path: ['end_time'], message: 'Provide a valid start and end time' });
});

// The reason is customer-facing (shown in the account and emailed): strip control characters, keep 3-300 chars.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const rejectSchema = z.object({
  reason: z.string().trim().max(300).transform((s) => s.replace(CONTROL_CHARS, '').trim()).refine((s) => s.length >= 3, 'Reason must be at least 3 characters'),
}).strict();

export const adminApptQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  date: date.optional(),
  service_id: uuid.optional(),
  payment_status: z.enum(['pending', 'submitted', 'verified', 'rejected']).optional(),
  appointment_status: z.enum(['pending', 'payment_submitted', 'payment_verified', 'confirmed', 'rejected', 'cancelled', 'completed']).optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

/** Defaults keep the previous behaviour (first 1000 users) while making the range explicit and bounded. */
export const usersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(1000),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[+\d][\d\s\-]{6,18}$/, 'Invalid phone number'),
}).strict();