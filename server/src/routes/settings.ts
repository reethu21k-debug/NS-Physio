import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError, fromDbError } from '../lib/errors.js';
import { ok } from '../middleware/error.js';
import { profileSchema, settingsSchema } from '../lib/schemas.js';
import { audit, getSettings } from '../lib/helpers.js';
import { deleteImage, uploadImage } from '../lib/cloudinary.js';
import { imageUpload } from '../middleware/upload.js';

export const settings = Router();

// Public clinic info (no payment details)
settings.get('/', async (_req, res) => {
  const s = await getSettings();
  ok(res, {
    clinic_name: s.clinic_name, phone: s.phone, email: s.email, address: s.address, about_text: s.about_text,
    morning_start: s.morning_start, morning_end: s.morning_end, evening_start: s.evening_start, evening_end: s.evening_end,
    slot_duration: s.slot_duration, timezone: s.timezone, cancellation_hours: s.cancellation_hours, booking_window_days: s.booking_window_days,
  });
});
// Signed-in users only: UPI details
settings.get('/payment', requireAuth, async (_req, res) => {
  const s = await getSettings();
  ok(res, { upi_id: s.upi_id, upi_qr_url: s.upi_qr_url });
});
settings.get('/full', requireAuth, requireAdmin, async (_req, res) => ok(res, await getSettings()));

settings.patch('/', requireAuth, requireAdmin, async (req, res) => {
  const v = settingsSchema.parse(req.body);
  const s = await getSettings();
  const { data, error } = await supabase.from('clinic_settings').update(v).eq('id', s.id).select().single();
  if (error) throw fromDbError(error);
  await audit(req.user!.id, 'SETTINGS_UPDATED', 'clinic_settings', s.id, v);
  ok(res, data);
});
settings.post('/qr', requireAuth, requireAdmin, ...imageUpload('file'), async (req, res) => {
  const s = await getSettings();
  const up = await uploadImage(req.file!.buffer, 'clinic');
  const { data, error } = await supabase.from('clinic_settings').update({ upi_qr_url: up.url, upi_qr_cloudinary_public_id: up.publicId }).eq('id', s.id).select().single();
  if (error) { await deleteImage(up.publicId); throw fromDbError(error); }
  await deleteImage(s.upi_qr_cloudinary_public_id);
  await audit(req.user!.id, 'UPI_QR_UPDATED', 'clinic_settings', s.id);
  ok(res, data);
});

// Own profile (name/phone only — role and email are immutable from the client)
export const profile = Router();
profile.use(requireAuth);
profile.get('/', async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('id,full_name,email,phone,role,created_at').eq('id', req.user!.id).single();
  if (error) throw fromDbError(error);
  ok(res, data);
});
profile.patch('/', async (req, res) => {
  const v = profileSchema.parse(req.body); // v.phone is already normalised to +91XXXXXXXXXX
  // A mobile number identifies exactly one account (it is used to sign in). The DB unique index is the final guard.
  const { data: clash, error: clashErr } = await supabase.from('profiles').select('id')
    .eq('phone_normalized', v.phone).neq('id', req.user!.id).limit(1);
  if (clashErr) throw fromDbError(clashErr);
  if (clash?.length) throw new HttpError(409, 'This mobile number is already registered to another account.');
  const { data, error } = await supabase.from('profiles').update(v).eq('id', req.user!.id).select('id,full_name,email,phone,role').single();
  if (error) throw fromDbError(error);
  ok(res, data);
});