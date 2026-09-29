import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { formatPrice } from '../../lib/format';
import type { PricingType, Service } from '../../lib/types';
import { Button, ErrorState, PageTitle, Spinner } from '../../components/ui';

interface Draft { pricing_type: PricingType; price: string }
const field = 'min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-2 text-sm';

export default function AdminPrices() {
  const toast = useToast();
  const q = useAsync(() => api<Service[]>('/services/all'));
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  if (q.loading && !q.data) return <Spinner />;
  if (q.error || !q.data) return <ErrorState message={q.error ?? 'Unable to load services'} onRetry={() => void q.reload()} />;

  const cur = (s: Service): Draft => draft[s.id] ?? { pricing_type: s.pricing_type, price: s.price != null ? String(s.price) : '' };
  const changed = (s: Service) => { const d = cur(s); return d.pricing_type !== s.pricing_type || (d.pricing_type !== 'contact' || d.price !== '' ? Number(d.price || 0) !== Number(s.price ?? 0) : s.price !== null); };
  const dirty = q.data.filter(changed);
  const invalid = (s: Service) => { const d = cur(s); return d.pricing_type !== 'contact' && !(Number(d.price) > 0); };
  const hasInvalid = dirty.some(invalid);
  const patch = (s: Service, p: Partial<Draft>) => setDraft((x) => ({ ...x, [s.id]: { ...cur(s), ...p } }));

  async function save() {
    setBusy(true);
    try {
      const items = dirty.map((s) => { const d = cur(s); return { id: s.id, pricing_type: d.pricing_type, price: d.pricing_type === 'contact' && !d.price ? null : Number(d.price) }; });
      const r = await api<{ updated: number }>('/admin/service-prices', { method: 'PATCH', body: { items } });
      toast.success(`${r.updated} price${r.updated === 1 ? '' : 's'} updated. The website now shows the new prices.`);
      setDraft({}); await q.reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <PageTitle title="Service prices" subtitle="Changes apply immediately to the Home, Services and Booking pages. Existing bookings keep the price they were booked at."
        action={<Link to="/admin/services" className="text-sm text-navy underline">Edit other service details</Link>} />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Service</th><th className="px-4 py-3">Pricing type</th><th className="px-4 py-3">Price (₹)</th><th className="px-4 py-3">Shown on website</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {q.data.map((s) => {
              const d = cur(s);
              return (
                <tr key={s.id} className={changed(s) ? 'bg-gold/10' : ''}>
                  <td className="px-4 py-3"><p className="font-medium">{s.name}</p>{s.is_active === false && <p className="text-xs text-gray-500">Disabled</p>}</td>
                  <td className="px-4 py-3"><select aria-label={`Pricing type for ${s.name}`} className={field} value={d.pricing_type} onChange={(e) => patch(s, { pricing_type: e.target.value as PricingType })}>
                    <option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="contact">Contact for pricing</option></select></td>
                  <td className="px-4 py-3"><input aria-label={`Price for ${s.name}`} className={`${field} max-w-[140px]`} type="number" min="1" step="0.01" inputMode="decimal" disabled={d.pricing_type === 'contact'} value={d.pricing_type === 'contact' ? '' : d.price} onChange={(e) => patch(s, { price: e.target.value })} />
                    {invalid(s) && <p className="mt-1 text-xs text-red-600">Enter a price above 0</p>}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatPrice(s.pricing_type, s.price)}</td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <span className="text-sm text-gray-600">{dirty.length ? `${dirty.length} unsaved change${dirty.length === 1 ? '' : 's'}` : 'No changes'}</span>
        <Button variant="outline" disabled={!dirty.length || busy} onClick={() => setDraft({})}>Reset</Button>
        <Button variant="gold" loading={busy} disabled={!dirty.length || hasInvalid} onClick={() => void save()}>Save prices</Button>
      </div>
    </>
  );
}