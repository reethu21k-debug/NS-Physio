import { Link } from 'react-router-dom';
import { formatAmount, formatDate, formatDateTime, formatTime } from '../lib/format';
import { Button, StatusBadge } from './ui';

export interface AdminApptRow {
  id: string; appointment_date: string; start_time: string; amount: number | null; payment_method: string; payment_status: string;
  appointment_status: string; created_at: string; service?: { name: string } | null; customer?: { full_name: string; phone: string | null; email: string } | null;
  actions?: { confirm: boolean; approve: boolean };
}
const short = (id: string) => id.slice(0, 8).toUpperCase();
const canAct = (a: AdminApptRow) => !!(a.actions?.confirm || a.actions?.approve);
const label = (a: AdminApptRow) => (a.actions?.approve ? 'Approve' : 'Confirm');

interface Props { items: AdminApptRow[]; onConfirm?: (a: AdminApptRow) => void; busyId?: string | null }

/** Table on desktop, stacked cards on mobile. Shows a Confirm/Approve button when onConfirm is provided. */
export function AppointmentTable({ items, onConfirm, busyId }: Props) {
  const withAction = !!onConfirm;
  const heads = ['ID', 'Customer', 'Service', 'Date & time', 'Amount', 'Payment', 'Status', 'Booked', ...(withAction ? ['Action'] : [])];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>
            {heads.map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-3"><Link to={`/admin/appointments/${a.id}`} className="font-mono text-navy underline">{short(a.id)}</Link></td>
                <td className="px-3 py-3"><p className="font-medium">{a.customer?.full_name}</p><p className="text-xs text-gray-500">{a.customer?.phone}</p></td>
                <td className="px-3 py-3">{a.service?.name}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatDate(a.appointment_date)}<br /><span className="text-gray-500">{formatTime(a.start_time)}</span></td>
                <td className="whitespace-nowrap px-3 py-3">{formatAmount(a.amount)}</td>
                <td className="px-3 py-3"><p className="mb-1 text-xs capitalize text-gray-500">{a.payment_method}</p><StatusBadge status={a.payment_status} /></td>
                <td className="px-3 py-3"><StatusBadge status={a.appointment_status} /></td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">{formatDateTime(a.created_at)}</td>
                {withAction && <td className="px-3 py-3">{canAct(a) ? <Button variant="gold" loading={busyId === a.id} onClick={() => onConfirm?.(a)}>{label(a)}</Button> : <span className="text-xs text-gray-400">—</span>}</td>}
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {items.map((a) => (
          <div key={a.id} className="card space-y-2">
            <Link to={`/admin/appointments/${a.id}`} className="block space-y-2">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-navy">{a.customer?.full_name}</p><p className="text-xs text-gray-500">{a.customer?.phone}</p></div><span className="font-mono text-xs text-gray-500">{short(a.id)}</span></div>
              <p className="text-sm">{a.service?.name} · {formatDate(a.appointment_date)}, {formatTime(a.start_time)}</p>
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={a.appointment_status} /><StatusBadge status={a.payment_status} /><span className="ml-auto text-sm font-medium">{formatAmount(a.amount)}</span></div>
            </Link>
            {withAction && canAct(a) && <Button variant="gold" loading={busyId === a.id} onClick={() => onConfirm?.(a)} className="w-full">{label(a)}</Button>}
          </div>))}
      </div>
    </>
  );
}