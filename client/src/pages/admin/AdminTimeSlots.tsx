import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { formatDate, formatTime, todayIn } from '../../lib/format';
import type { Slot } from '../../lib/types';
import { Button, ConfirmDialog, ErrorState, Input, PageTitle, Select, Spinner } from '../../components/ui';

interface Block { id: string; is_full_day: boolean; start_time: string | null; end_time: string | null; reason: string; note: string | null }
interface Day { date: string; open: boolean; closedReason?: string; slots: Slot[]; appointments: { id: string; start_time: string; customer: { full_name: string } | null }[]; blocks: Block[] }
const REASONS = ['Doctor unavailable', 'Holiday', 'Maintenance', 'Personal', 'Other'];

export default function AdminTimeSlots() {
  const toast = useToast();
  const [date, setDate] = useState(() => todayIn('Asia/Kolkata'));
  const q = useAsync(() => api<Day>(`/admin/slots?date=${date}`), [date]);
  const [sel, setSel] = useState<string[]>([]); const [reason, setReason] = useState(REASONS[0]!); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [closeAsk, setCloseAsk] = useState(false);
  const d = q.data;
  const isClosed = !!d?.blocks.some((b) => b.is_full_day);
  // For a closed day the API returns no slots, so show the day's blocks only.

  async function block(payloads: object[], msg = 'Time slot blocked.') {
    setBusy(true);
    try { for (const p of payloads) await api('/admin/slots/block', { body: { date, reason, ...(note.trim() ? { note: note.trim() } : {}), ...p } }); toast.success(msg); setSel([]); setCloseAsk(false); await q.reload(); }
    catch (e) { toast.error(errMsg(e)); await q.reload(); } finally { setBusy(false); }
  }
  async function unblock(id: string) {
    try { await api(`/admin/slots/block/${id}`, { method: 'DELETE' }); toast.success('Block removed.'); await q.reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  const byStart = new Map(d?.slots.map((s) => [s.start, s]));
  const blockSelected = () => void block(sel.map((st) => ({ full_day: false, start_time: st, end_time: byStart.get(st)!.end })));
  const stateCls = (s: Slot, on: boolean) => on ? 'border-gold bg-gold font-bold text-navy-dark' : s.state === 'available' ? 'border-gray-300 bg-white hover:border-gold' : s.state === 'booked' ? 'border-blue-200 bg-blue-50 text-blue-900' : s.state === 'blocked' ? 'border-red-200 bg-red-50 text-red-900' : 'border-gray-200 bg-gray-100 text-gray-400';

  return (
    <>
      <PageTitle title="Time Slots" subtitle="Block slots or close the clinic. Blocked times disappear from customer availability." />
      <div className="card mb-4 max-w-xs"><Input label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSel([]); }} /></div>
      {q.loading && !d ? <Spinner /> : q.error || !d ? <ErrorState message={q.error ?? 'Unable to load'} onRetry={() => void q.reload()} /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="card"><h2 className="mb-3 text-lg">{formatDate(date)}</h2>
            {isClosed ? <p className="rounded-lg bg-red-50 p-4 text-sm text-red-900">Clinic closed on this date. Remove the closure below to reopen.</p>
              : !d.open ? <p className="text-sm text-gray-600">{d.closedReason === 'past' ? 'This date is in the past.' : 'This date is outside the booking window.'}</p> : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {d.slots.map((s) => { const on = sel.includes(s.start); const appt = d.appointments.find((a) => a.start_time.slice(0, 5) === s.start);
                    return (<button key={s.start} type="button" disabled={s.state !== 'available'} aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== s.start) : [...sel, s.start])}
                      className={`min-h-[52px] rounded-lg border px-2 py-1 text-sm ${stateCls(s, on)}`}>{formatTime(s.start)}
                      <span className="block text-[10px] font-normal">{s.state === 'booked' ? (appt?.customer?.full_name ?? 'Booked') : s.state === 'available' ? (on ? 'Selected' : 'Open') : s.state === 'blocked' ? 'Blocked' : 'Passed'}</span></button>); })}
                </div>)}
          </section>
          <div className="space-y-4">
            <section className="card space-y-3"><h2 className="text-lg">Block time</h2>
              <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
              <Input label="Note (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
              <Button variant="gold" className="w-full" loading={busy} disabled={!sel.length} onClick={blockSelected}>Block selected slots ({sel.length})</Button>
              <Button variant="danger" className="w-full" disabled={isClosed || !d.open && d.closedReason === 'past'} onClick={() => setCloseAsk(true)}>Close clinic for this date</Button></section>
            <section className="card"><h2 className="mb-2 text-lg">Blocks on this date</h2>
              {!d.blocks.length ? <p className="text-sm text-gray-500">None.</p> : <ul className="space-y-2">{d.blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-sm"><span>{b.is_full_day ? 'Clinic closed' : `${formatTime(b.start_time!)} – ${formatTime(b.end_time!)}`}<span className="block text-xs text-gray-500">{b.reason}{b.note ? ` · ${b.note}` : ''}</span></span>
                  <button aria-label="Remove block" onClick={() => void unblock(b.id)} className="rounded p-2 hover:bg-gray-100"><Trash2 className="h-4 w-4 text-red-700" /></button></li>))}</ul>}</section>
          </div>
        </div>)}
      <ConfirmDialog open={closeAsk} title="Close clinic for this date?" danger confirmLabel="Close clinic" loading={busy} onConfirm={() => void block([{ full_day: true }], 'Time slot blocked.')} onClose={() => setCloseAsk(false)}
        message={<>All slots on <strong>{formatDate(date)}</strong> will be unavailable. This is refused if active appointments exist that day.</>} />
    </>
  );
}
