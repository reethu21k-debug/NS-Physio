import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import '../lib/cloudinary.js'; // ensures cloudinary.config() has run
import { HttpError } from '../lib/errors.js';
import { uuid } from '../lib/schemas.js';
import { loadAppointment, onePayment } from '../lib/helpers.js';

/** Mounted inside adminRouter, so requireAuth + requireAdmin already apply. Streams the payment screenshot to admins only. */
export const proofRouter = Router();

proofRouter.get('/appointments/:id/proof', async (req, res) => {
  const a = await loadAppointment(uuid.parse(req.params.id));
  const publicId = onePayment(a)?.cloudinary_public_id;
  if (!publicId) throw new HttpError(404, 'No screenshot has been uploaded for this appointment yet.');

  // New proofs are private ("authenticated"); older public uploads are still readable by admins.
  const type = publicId.includes('/payment-proofs/') ? 'authenticated' : 'upload';
  const url = cloudinary.url(publicId, { type, resource_type: 'image', sign_url: type === 'authenticated', secure: true });

  const r = await fetch(url).catch((e: unknown) => {
    console.error('[proof] fetch failed', publicId, e);
    throw new HttpError(502, 'Could not reach the image storage. Please try again.');
  });
  if (!r.ok) {
    const cld = r.headers.get('x-cld-error');
    console.error('[proof] cloudinary refused', r.status, cld, publicId);
    throw new HttpError(502, `Image storage could not deliver the screenshot (HTTP ${r.status}${cld ? `: ${cld}` : ''}).`);
  }
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.startsWith('image/')) throw new HttpError(502, 'The stored file is not an image.');
  res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(Buffer.from(await r.arrayBuffer()));
});