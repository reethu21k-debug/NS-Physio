import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { formatPrice, optimizeImg } from '../../lib/format';
import type { Service } from '../../lib/types';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageTitle, Select, Spinner, Textarea } from '../../components/ui';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  description: z.string().trim().max(1000),
  pricing_type: z.enum(['fixed', 'starting_from', 'contact']),
  price: z.string(), duration_minutes: z.string().regex(/^\d+$/, 'Enter minutes'), display_order: z.string().regex(/^\d+$/, 'Enter a number'), is_active: z.boolean(),
}).refine((v) => v.pricing_type === 'contact' || Number(v.price) > 0, { path: ['price'], message: 'Enter a price greater than 0' });
type F = z.infer<typeof schema>;

function ServiceForm({ svc, onSaved, onClose }: { svc: Service | null; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { name: svc?.name ?? '', description: svc?.description ?? '', pricing_type: svc?.pricing_type ?? 'fixed', price: svc?.price != null ? String(svc.price) : '',
      duration_minutes: String(svc?.duration_minutes ?? 30), display_order: String(svc?.display_order ?? 99), is_active: svc?.is_active ?? true },
  });
  const [uploading, setUploading] = useState(false);
  const contact = watch('pricing_type') === 'contact';
  const onSubmit = async (v: F) => {
    const body = { name: v.name, description: v.description, pricing_type: v.pricing_type, price: v.pricing_type === 'contact' && !v.price ? null : Number(v.price),
      duration_minutes: Number(v.duration_minutes), display_order: Number(v.display_order), is_active: v.is_active };
    try {
      await api(svc ? `/services/${svc.id}` : '/services', { method: svc ? 'PATCH' : 'POST', body });
      toast.success('Service updated.'); onSaved();
    } catch (e) { toast.error(errMsg(e)); }
  };
  async function uploadImg(f?: File) {
    if (!f || !svc) return;
    setUploading(true);
    try { const form = new FormData(); form.append('file', f); await api(`/services/${svc.id}/image`, { form }); toast.success('Service updated.'); onSaved(); }
    catch (e) { toast.error(errMsg(e)); } finally { setUploading(false); }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <Input label="Name" error={errors.name?.message} {...register('name')} />
      <Textarea label="Description" error={errors.description?.message} {...register('description')} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Pricing type" {...register('pricing_type')}><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="contact">Contact for pricing</option></Select>
        <Input label="Price (₹)" type="number" step="0.01" min="0" disabled={contact} error={errors.price?.message} {...register('price')} />
        <Input label="Duration (min)" type="number" min="5" error={errors.duration_minutes?.message} {...register('duration_minutes')} />
        <Input label="Display order" type="number" min="0" error={errors.display_order?.message} {...register('display_order')} />
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-gold" {...register('is_active')} />Active (visible to customers)</label>
      {svc ? (
        <div className="rounded-lg border border-dashed p-3 text-sm">
          {svc.image_url && <img src={optimizeImg(svc.image_url, 300)} alt="" className="mb-2 h-24 rounded" />}
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 hover:bg-gray-50"><Upload className="h-4 w-4" />{uploading ? 'Uploading…' : svc.image_url ? 'Replace image' : 'Add image'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void uploadImg(e.target.files?.[0])} disabled={uploading} /></label>
        </div>) : <p className="text-xs text-gray-500">Save the service first, then edit it to add an image.</p>}
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Close</Button><Button type="submit" variant="gold" loading={isSubmitting}>Save service</Button></div>
    </form>
  );
}

export default function AdminServices() {
  const toast = useToast();
  const q = useAsync(() => api<Service[]>('/services/all'));
  const [edit, setEdit] = useState<Service | 'new' | null>(null);
  const [del, setDel] = useState<Service | null>(null); const [busy, setBusy] = useState(false);
  const list = q.data ?? [];

  async function move(i: number, dir: -1 | 1) {
    const ids = list.map((s) => s.id); const j = i + dir; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    try { await api('/services/reorder', { method: 'PATCH', body: { ids } }); await q.reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  async function remove() {
    if (!del) return; setBusy(true);
    try { await api(`/services/${del.id}`, { method: 'DELETE' }); toast.success('Service updated.'); setDel(null); await q.reload(); }
    catch (e) { toast.error(errMsg(e)); setDel(null); } finally { setBusy(false); }
  }
  async function toggle(s: Service) {
    try { await api(`/services/${s.id}`, { method: 'PATCH', body: { name: s.name, description: s.description, pricing_type: s.pricing_type, price: s.price, duration_minutes: s.duration_minutes, display_order: s.display_order, is_active: !s.is_active } });
      toast.success('Service updated.'); await q.reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <>
      <PageTitle title="Services" subtitle="Changes appear on the public website immediately." action={<Button variant="gold" onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add Service</Button>} />
      {q.loading && !q.data ? <Spinner /> : q.error ? <ErrorState message={q.error} onRetry={() => void q.reload()} /> : !list.length ? <EmptyState title="No services yet." /> : (
        <div className="space-y-3">
          {list.map((s, i) => (
            <article key={s.id} className={`card flex flex-wrap items-center gap-3 ${s.is_active ? '' : 'bg-gray-50 opacity-80'}`}>
              <div className="flex flex-col"><button aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => void move(i, -1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button aria-label={`Move ${s.name} down`} disabled={i === list.length - 1} onClick={() => void move(i, 1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button></div>
              <div className="min-w-0 flex-1"><p className="font-semibold text-navy">{s.name} {!s.is_active && <span className="ml-1 rounded bg-gray-200 px-2 py-0.5 text-xs">Disabled</span>}</p>
                <p className="text-sm text-gray-600">{formatPrice(s.pricing_type, s.price)} · {s.duration_minutes} min</p></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void toggle(s)}>{s.is_active ? 'Disable' : 'Enable'}</Button>
                <Button variant="outline" onClick={() => setEdit(s)} aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" />Edit</Button>
                <Button variant="ghost" onClick={() => setDel(s)} aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4 text-red-700" /></Button></div>
            </article>))}
        </div>)}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add service' : 'Edit service'}>
        {edit && <ServiceForm key={edit === 'new' ? 'new' : edit.id} svc={edit === 'new' ? null : edit} onSaved={() => { setEdit(null); void q.reload(); }} onClose={() => setEdit(null)} />}
      </Modal>
      <ConfirmDialog open={!!del} title="Delete service?" danger loading={busy} confirmLabel="Delete" onConfirm={remove} onClose={() => setDel(null)}
        message={<>Delete <strong>{del?.name}</strong>? Services with appointment history cannot be deleted — disable them instead.</>} />
    </>
  );
}
