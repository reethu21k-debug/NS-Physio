import { useRef, useState } from 'react';
import { Copy, Upload } from 'lucide-react';
import type { Appointment, FullSettings } from '../lib/types';
import { api, errMsg } from '../lib/api';
import { formatRupees, optimizeImg } from '../lib/format';
import { useToast } from '../lib/toast';
import { useAsync } from '../lib/useAsync';
import { Button, Spinner, StatusBadge } from './ui';

const MAX = 5 * 1024 * 1024;

/** UPI instructions + screenshot (re)upload for an online-payment appointment. */
export function PaymentPanel({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const toast = useToast();
  const pay = useAsync(() => api<Pick<FullSettings, 'upi_id' | 'upi_qr_url'>>('/settings/payment'));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const p = appt.payment;
  const canUpload = ['pending', 'rejected'].includes(appt.payment_status) && ['pending', 'payment_submitted'].includes(appt.appointment_status);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return toast.error('Please choose a JPG, PNG or WebP image.');
    if (f.size > MAX) return toast.error('Image is too large (max 5 MB).');
    setFile(f); setPreview(URL.createObjectURL(f));
  }
  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData(); form.append('file', file);
      await api(`/payments/${appt.id}/upload-proof`, { form });
      toast.success('Payment screenshot uploaded successfully.');
      setFile(null); setPreview(null); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  if (pay.loading) return <Spinner />;
  return (
    <section className="card space-y-4" aria-labelledby="pay-h">
      <div className="flex items-center justify-between gap-2"><h2 id="pay-h" className="text-xl">Online Payment</h2><StatusBadge status={appt.payment_status} /></div>
      {p?.status === 'rejected' && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          Your payment could not be verified{p.rejection_reason ? `: ${p.rejection_reason}` : '.'} Please upload a valid screenshot below.
        </div>
      )}
      {appt.amount !== null && <p className="text-sm text-gray-600">Amount to pay: <strong className="font-display text-2xl text-navy">{formatRupees(appt.amount)}</strong></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {pay.data?.upi_qr_url ? <img src={optimizeImg(pay.data.upi_qr_url, 480)} alt="UPI payment QR code" className="mx-auto w-full max-w-[240px] rounded-lg border" /> : <p className="text-sm text-gray-500">QR code not configured yet.</p>}
        <div className="space-y-3 text-sm">
          <div><p className="text-gray-500">UPI ID</p>
            {pay.data?.upi_id ? <p className="flex items-center gap-2 break-all font-semibold">{pay.data.upi_id}
              <button type="button" aria-label="Copy UPI ID" className="rounded p-1 hover:bg-gray-100" onClick={() => { void navigator.clipboard.writeText(pay.data!.upi_id); toast.success('UPI ID copied.'); }}><Copy className="h-4 w-4" /></button></p>
              : <p className="text-gray-500">Not configured yet — please pay at the clinic or contact us.</p>}</div>
          <ol className="list-decimal space-y-1 pl-5 text-gray-700"><li>Scan the QR code</li><li>Complete the payment</li><li>Take a screenshot</li><li>Upload the screenshot below</li></ol>
        </div>
      </div>
      {p?.screenshot_url && <div><p className="mb-1 text-sm text-gray-500">Your submitted screenshot</p><img src={optimizeImg(p.screenshot_url, 600)} alt="Your payment screenshot" loading="lazy" className="max-h-64 rounded-lg border" /></div>}
      {canUpload && (
        <div className="space-y-3 border-t pt-4">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose payment screenshot" onChange={(e) => pick(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => input.current?.click()} className="w-full sm:w-auto"><Upload className="h-4 w-4" />{file ? 'Choose a different file' : 'Choose Screenshot'}</Button>
          {preview && <img src={preview} alt="Selected screenshot preview" className="max-h-56 rounded-lg border" />}
          <Button variant="gold" loading={busy} disabled={!file} onClick={submit} className="w-full sm:w-auto">{busy ? 'Uploading payment screenshot…' : 'Submit Payment Proof'}</Button>
        </div>
      )}
    </section>
  );
}
