import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError, fromDbError } from '../lib/errors.js';
import { ok } from '../middleware/error.js';
import { reorderSchema, serviceSchema, serviceUpdateSchema, uuid } from '../lib/schemas.js';
import { audit, fromRpcError } from '../lib/helpers.js';
import { deleteImage, uploadImage } from '../lib/cloudinary.js';
import { imageUpload } from '../middleware/upload.js';

export const services = Router();

// Public: active services only
services.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('services').select('id,name,description,pricing_type,price,duration_minutes,image_url,display_order')
    .eq('is_active', true).order('display_order').order('created_at');
  if (error) throw fromDbError(error);
  ok(res, data);
});

const admin = Router();
admin.use(requireAuth, requireAdmin);

admin.get('/all', async (_req, res) => {
  const { data, error } = await supabase.from('services').select('*').order('display_order').order('created_at');
  if (error) throw fromDbError(error);
  ok(res, data);
});
admin.post('/', async (req, res) => {
  const v = serviceSchema.parse(req.body);
  const row = { ...v, price: v.pricing_type === 'contact' ? (v.price ?? null) : v.price };
  const { data, error } = await supabase.from('services').insert(row).select().single();
  if (error) throw fromDbError(error);
  await audit(req.user!.id, 'SERVICE_CREATED', 'service', data.id, row);
  ok(res, data, 201);
});
admin.patch('/reorder', async (req, res) => {
  const { ids } = reorderSchema.parse(req.body);
  // One database function = one transaction: all rows are re-numbered or none are; unknown ids are rejected (404), never ignored.
  const { error } = await supabase.rpc('reorder_services', { p_ids: ids });
  if (error) throw fromRpcError(error);
  await audit(req.user!.id, 'SERVICES_REORDERED', 'service', null, { ids });
  ok(res, { ids });
});
admin.patch('/:id', async (req, res) => {
  const id = uuid.parse(req.params.id);
  const v = serviceUpdateSchema.parse(req.body);
  if (!Object.keys(v).length) throw new HttpError(400, 'Nothing to update.');
  const { data: cur, error: curErr } = await supabase.from('services').select('pricing_type,price').eq('id', id).maybeSingle();
  if (curErr) throw fromDbError(curErr);
  if (!cur) throw new HttpError(404, 'Service not found.');
  const type = v.pricing_type ?? cur.pricing_type;
  const price = v.price !== undefined ? v.price : cur.price;
  if (type !== 'contact' && !(Number(price) > 0)) throw new HttpError(400, 'Price is required for fixed and starting-from pricing');
  // Only keys the client actually sent are written; omitted columns (is_active, display_order, ...) keep their stored values.
  const patch = Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined));
  const { data, error } = await supabase.from('services').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, 'Service not found.');
  await audit(req.user!.id, 'SERVICE_UPDATED', 'service', id, patch);
  ok(res, data);
});
admin.post('/:id/image', ...imageUpload('file'), async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { data: svc, error: svcErr } = await supabase.from('services').select('cloudinary_public_id').eq('id', id).maybeSingle();
  if (svcErr) throw fromDbError(svcErr);
  if (!svc) throw new HttpError(404, 'Service not found.');
  if (!req.file) throw new HttpError(400, 'Please attach an image.');
  const up = await uploadImage(req.file.buffer, 'services');
  const { data, error } = await supabase.from('services').update({ image_url: up.url, cloudinary_public_id: up.publicId }).eq('id', id).select().single();
  if (error) { await deleteImage(up.publicId); throw fromDbError(error); }
  await deleteImage(svc.cloudinary_public_id);
  await audit(req.user!.id, 'SERVICE_IMAGE_UPDATED', 'service', id);
  ok(res, data);
});
// Safe delete: only when no appointment references the service; otherwise 409 → disable instead.
admin.delete('/:id', async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { count, error: cntErr } = await supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('service_id', id);
  if (cntErr) throw fromDbError(cntErr); // never delete on the strength of a failed count
  if (count) throw new HttpError(409, 'This service has appointment history and cannot be deleted. Disable it instead.');
  const { data: svc, error: getErr } = await supabase.from('services').select('cloudinary_public_id').eq('id', id).maybeSingle();
  if (getErr) throw fromDbError(getErr);
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw fromDbError(error);
  await deleteImage(svc?.cloudinary_public_id);
  await audit(req.user!.id, 'SERVICE_DELETED', 'service', id);
  ok(res, { id });
});
services.use(admin);