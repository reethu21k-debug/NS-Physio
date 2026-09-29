import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError, fromDbError } from '../lib/errors.js';
import { ok } from '../middleware/error.js';
import { rejectSchema, uuid } from '../lib/schemas.js';
import { emailData, fromRpcError, getSettings, loadAppointment, onePayment } from '../lib/helpers.js';
import { canRejectPayment, canUploadProof, canVerifyPayment } from '../lib/status.js';
import { deleteImage, proofUrl, uploadImage } from '../lib/cloudinary.js';
import { imageUpload } from '../middleware/upload.js';
import { sendEmail, templates } from '../lib/email.js';

export const payments = Router();
payments.use(requireAuth);

/**
 * Every transition below is ONE database function (see supabase/migrations/0004_hardening.sql). Inside it the appointment
 * and payment rows are locked (FOR UPDATE), compared with the state this request observed, updated together, and the
 * appointment event + audit log are written in the same transaction. If either row changed in the meantime the function
 * raises P0409 -> HTTP 409, and nothing is written. There is no read-then-write window and no manual "rollback" step.
 */

// User uploads / re-uploads payment proof for their own appointment
payments.post('/:appointmentId/upload-proof', ...imageUpload('file'), async (req, res) => {
  const a = await loadAppointment(uuid.parse(req.params.appointmentId));
  if (a.user_id !== req.user!.id) throw new HttpError(404, 'Appointment not found.');
  if (!canUploadProof(a)) throw new HttpError(400, 'Payment proof cannot be uploaded for this appointment right now.');
  const pay = onePayment(a);
  if (!pay) throw new HttpError(404, 'Payment record not found.');
  if (!req.file) throw new HttpError(400, 'Please attach an image.');

  const up = await uploadImage(req.file.buffer, 'payment-proofs'); // filename is never used; stored as a private (authenticated) asset
  let oldPublicId: string | null = null;
  try {
    const { data, error } = await supabase.rpc('payment_submit_proof', {
      p_appointment_id: a.id, p_payment_id: pay.id, p_actor: req.user!.id,
      p_from_appt_status: a.appointment_status, p_from_appt_pay_status: a.payment_status, p_from_pay_status: pay.status,
      p_url: up.url, p_public_id: up.publicId,
    });
    if (error) throw fromRpcError(error, 'This payment was just updated by someone else. Please refresh.');
    oldPublicId = (data as string | null) ?? null;
  } catch (e) { await deleteImage(up.publicId); throw e; } // the DB rolled back everything; drop the orphaned upload
  await deleteImage(oldPublicId);
  ok(res, { screenshot_url: proofUrl(up.publicId), status: 'submitted' });
});

async function loadPayment(id: string) {
  const { data, error } = await supabase.from('payments').select('id,appointment_id').eq('id', id).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, 'Payment not found.');
  const a = await loadAppointment(data.appointment_id as string);
  const pay = onePayment(a);
  if (!pay || pay.id !== data.id) throw new HttpError(404, 'Payment not found.');
  return { pay, a };
}

payments.post('/:id/verify', requireAdmin, async (req, res) => {
  const { pay, a } = await loadPayment(uuid.parse(req.params.id));
  if (!canVerifyPayment(a)) throw new HttpError(400, 'This payment cannot be verified in its current state.');
  const { error } = await supabase.rpc('payment_verify', {
    p_appointment_id: a.id, p_payment_id: pay.id, p_actor: req.user!.id,
    p_from_appt_status: a.appointment_status, p_from_appt_pay_status: a.payment_status, p_from_pay_status: pay.status,
  });
  if (error) throw fromRpcError(error, 'This payment was just updated by someone else. Please refresh.');
  ok(res, { payment_status: 'verified', appointment_status: 'payment_verified' });
});

payments.post('/:id/reject', requireAdmin, async (req, res) => {
  const { reason } = rejectSchema.parse(req.body); // server-side validated + sanitised; the client is not trusted
  const { pay, a } = await loadPayment(uuid.parse(req.params.id));
  if (!canRejectPayment(a)) throw new HttpError(400, 'This payment cannot be rejected in its current state.');
  // Appointment returns to 'pending' so the user can upload a new screenshot.
  const { error } = await supabase.rpc('payment_reject', {
    p_appointment_id: a.id, p_payment_id: pay.id, p_actor: req.user!.id, p_reason: reason,
    p_from_appt_status: a.appointment_status, p_from_appt_pay_status: a.payment_status, p_from_pay_status: pay.status,
  });
  if (error) throw fromRpcError(error, 'This payment was just updated by someone else. Please refresh.');
  const d = emailData(a, await getSettings());
  if (d) void sendEmail(d.to, templates.paymentRejected(d, reason));
  ok(res, { payment_status: 'rejected', appointment_status: 'pending' });
});