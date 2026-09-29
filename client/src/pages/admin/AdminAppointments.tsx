import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import type { Service } from '../../lib/types';
import { AppointmentTable, type AdminApptRow } from '../../components/AppointmentTable';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, PageTitle, Select, Spinner } from '../../components/ui';

const AS = ['pending', 'payment_submitted', 'payment_verified', 'confirmed', 'rejected', 'cancelled', 'completed'];
const PS = ['pending', 'submitted', 'verified', 'rejected'];
interface Res { items: AdminApptRow[]; total: number; page: number; page_size: number }

export default function AdminAppointments() {
  const toast = useToast();
  const [f, setF] = useState({ q: '', date: '', service_id: '', payment_status: '', appointment_status: '', sort: 'desc', sort_by: 'created' });
  const [debounced, setDebounced] = useState(f.q);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminApptRow | null>(null);
  const [busy, setBusy] = useState(false);
  const services = useAsync(() => api<Service[]>('/services/all'));
  useEffect(() => { const t = setTimeout(() => { setDebounced(f.q); setPage(1); }, 350); return () => clearTimeout(t); }, [f.q]);
  const params = new URLSearchParams({ page: String(page), page_size: '15', sort: f.sort, sort_by: f.sort_by });
  (['date', 'service_id', 'payment_status', 'appointment_status'] as const).forEach((k) => f[k] && params.set(k, f[k]));
  if (debounced) params.set('q', debounced);
  const q = useAsync(() => api<Res>(`/admin/appointments?${params}`), [params.toString()]);
  // New website bookings show up without a manual refresh.
  useEffect(() => { const t = setInterval(() => void q.reload(), 30_000); return () => clearInterval(t); }, [q.reload]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); if (k !== 'q') setPage(1); };
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.page_size)) : 1;

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try { await api(`/admin/appointments/${target.id}/confirm`, { method: 'POST', body: {} }); toast.success('Appointment confirmed.'); setTarget(null); await q.reload(); }
    catch (e) { toast.error(errMsg(e)); setTarget(null); } finally { setBusy(false); }
  }
  const approve = !!target?.actions?.approve;
  return (
    <>
      <PageTitle title="Appointments" subtitle={q.data ? `${q.data.total} total` : undefined} />
      <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative"><Input label="Search" placeholder="Name, phone, email or ID" value={f.q} onChange={set('q')} /><Search className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-gray-400" aria-hidden /></div>
        <Input label="Appointment date" type="date" value={f.date} onChange={set('date')} />
        <Select label="Service" value={f.service_id} onChange={set('service_id')}><option value="">All services</option>{services.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select label="Payment status" value={f.payment_status} onChange={set('payment_status')}><option value="">All</option>{PS.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Select label="Appointment status" value={f.appointment_status} onChange={set('appointment_status')}><option value="">All</option>{AS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>
        <Select label="Sort" value={`${f.sort_by}:${f.sort}`} onChange={(e) => { const [b, d] = e.target.value.split(':'); setF((s) => ({ ...s, sort_by: b!, sort: d! })); setPage(1); }}>
          <option value="created:desc">Newest bookings first</option><option value="created:asc">Oldest bookings first</option>
          <option value="date:desc">Appointment date (latest)</option><option value="date:asc">Appointment date (earliest)</option>
        </Select>
      </div>
      {q.loading && !q.data ? <Spinner /> : q.error ? <ErrorState message={q.error} onRetry={() => void q.reload()} /> : !q.data?.items.length ? <EmptyState title="No appointments match your filters." /> : (
        <>
          <AppointmentTable items={q.data.items} onConfirm={setTarget} busyId={busy ? target?.id : null} />
          <div className="mt-4 flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-gray-600">Page {page} of {pages}</span><Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>
        </>)}
      <ConfirmDialog open={!!target} title={approve ? 'Approve and confirm?' : 'Confirm appointment?'}
        message={approve ? 'This verifies the submitted payment and confirms the appointment. The customer will be emailed.' : 'The customer will be emailed a confirmation.'}
        confirmLabel={approve ? 'Approve & Confirm' : 'Confirm'} loading={busy} onConfirm={() => void confirm()} onClose={() => setTarget(null)} />
    </>
  );
}