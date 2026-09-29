import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Upload } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { optimizeImg } from '../../lib/format';
import type { FullSettings } from '../../lib/types';
import { Button, ErrorState, Input, PageTitle, Spinner, Textarea } from '../../components/ui';

type Row = FullSettings & Record<string, string | number | null>;
const NUMS = ['slot_duration', 'cancellation_hours', 'booking_window_days'] as const;

function Form({ s, reload }: { s: Row; reload: () => void }) {
  const toast = useToast();
  const t = (v: unknown) => String(v ?? '').slice(0, 5);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: {
    clinic_name: s.clinic_name, phone: s.phone, email: s.email, address: s.address, about_text: s.about_text,
    morning_start: t(s.morning_start), morning_end: t(s.morning_end), evening_start: t(s.evening_start), evening_end: t(s.evening_end),
    slot_duration: String(s.slot_duration), timezone: s.timezone, booking_window_days: String(s.booking_window_days), upi_id: s.upi_id, cancellation_hours: String(s.cancellation_hours) } });
  const [qr, setQr] = useState(false);
  const onSubmit = async (v: Record<string, string>) => {
    const body: Record<string, string | number> = { ...v };
    NUMS.forEach((k) => { body[k] = Number(v[k]); });
    try { await api('/settings', { method: 'PATCH', body }); toast.success('Settings saved.'); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  async function uploadQr(f?: File) {
    if (!f) return; setQr(true);
    try { const form = new FormData(); form.append('file', f); await api('/settings/qr', { form }); toast.success('Settings saved.'); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setQr(false); }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <section className="card grid gap-3 sm:grid-cols-2"><h2 className="text-lg sm:col-span-2">Clinic details</h2>
        <Input label="Clinic name" {...register('clinic_name')} /><Input label="Phone" {...register('phone')} /><Input label="Email" type="email" {...register('email')} />
        <Input label="Address" {...register('address')} /><Textarea className="sm:col-span-2" label="About text (shown on About page)" rows={4} {...register('about_text')} /></section>
      <section className="card grid gap-3 sm:grid-cols-2"><h2 className="text-lg sm:col-span-2">Timings</h2>
        <Input label="Morning start" type="time" {...register('morning_start')} /><Input label="Morning end" type="time" {...register('morning_end')} />
        <Input label="Evening start" type="time" {...register('evening_start')} /><Input label="Evening end" type="time" {...register('evening_end')} />
        <Input label="Slot duration (min)" type="number" min="5" {...register('slot_duration')} /><Input label="Timezone" hint="IANA name, e.g. Asia/Kolkata" {...register('timezone')} />
        <Input label="Booking window (days ahead)" type="number" min="1" {...register('booking_window_days')} /></section>
      <section className="card grid gap-3 sm:grid-cols-2"><h2 className="text-lg sm:col-span-2">Payments &amp; cancellation</h2>
        <Input label="UPI ID" placeholder="name@bank" {...register('upi_id')} /><Input label="Cancel allowed until (hours before)" type="number" min="0" {...register('cancellation_hours')} />
        <div className="sm:col-span-2"><p className="label">UPI QR code</p>{s.upi_qr_url && <img src={optimizeImg(s.upi_qr_url, 300)} alt="Current UPI QR" className="mb-2 h-36 rounded border" />}
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-gray-50"><Upload className="h-4 w-4" />{qr ? 'Uploading…' : s.upi_qr_url ? 'Replace QR' : 'Upload QR'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={qr} onChange={(e) => void uploadQr(e.target.files?.[0])} /></label></div></section>
      <Button type="submit" variant="gold" loading={isSubmitting}>Save settings</Button>
    </form>
  );
}
export default function AdminSettings() {
  const q = useAsync(() => api<Row>('/settings/full'));
  return (<><PageTitle title="Settings" subtitle="Slot changes apply to new bookings; existing appointments are unaffected." />
    {q.loading && !q.data ? <Spinner /> : q.error || !q.data ? <ErrorState message={q.error ?? 'Unable to load'} onRetry={() => void q.reload()} /> : <Form key={String(q.data.upi_qr_url)} s={q.data} reload={() => void q.reload()} />}</>);
}
