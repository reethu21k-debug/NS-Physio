import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatAmount, formatDate, formatDateTime, formatRupees, formatTime } from '../../lib/format';
import { DashboardCard, EmptyState, ErrorState, PageTitle, Spinner, StatusBadge } from '../../components/ui';

interface Row { id: string; appointment_date: string; start_time: string; appointment_status: string; service: { name: string } | null; customer: { full_name: string } | null }
interface Recent extends Row { created_at: string; payment_status: string; payment_method: string; amount: number | null }
interface Dash {
  today: string; today_appointments: number; pending: number; pending_payment_verification: number; confirmed: number; completed: number; cancelled: number;
  today_revenue: number; month_revenue: number; upcoming: Row[]; recent: Recent[];
}
interface Rev { statuses: string[]; months: { month: string; revenue: number; bookings: number }[]; total: number; bookings: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

export default function AdminDashboard() {
  const q = useAsync(() => api<Dash>('/admin/dashboard'));
  const rev = useAsync(() => api<Rev>('/admin/revenue?months=12'));
  // New website bookings appear without a manual refresh.
  useEffect(() => { const t = setInterval(() => { void q.reload(); void rev.reload(); }, 30_000); return () => clearInterval(t); }, [q.reload, rev.reload]);
  if (q.loading && !q.data) return <Spinner />;
  if (q.error || !q.data) return <ErrorState message={q.error ?? 'Unable to load'} onRetry={() => void q.reload()} />;
  const d = q.data;
  const max = Math.max(1, ...(rev.data?.months.map((m) => m.revenue) ?? [1]));
  return (
    <>
      <PageTitle title="Dashboard" subtitle={`Today: ${formatDate(d.today)}`} action={<Link to="/admin/prices" className="text-sm text-navy underline">Manage service prices</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardCard label="Today's appointments" value={d.today_appointments} accent />
        <DashboardCard label="Pending" value={d.pending} accent={d.pending > 0} />
        <DashboardCard label="Payments to verify" value={d.pending_payment_verification} accent={d.pending_payment_verification > 0} />
        <DashboardCard label="Confirmed (upcoming)" value={d.confirmed} />
        <DashboardCard label="Completed" value={d.completed} /><DashboardCard label="Cancelled" value={d.cancelled} />
        <DashboardCard label="Today's revenue" value={formatRupees(d.today_revenue)} />
        <DashboardCard label="This month's revenue" value={formatRupees(d.month_revenue)} accent />
      </div>

      <h2 className="mb-3 mt-8 text-xl">Latest bookings</h2>
      {!d.recent.length ? <EmptyState title="No bookings yet." /> : (
        <div className="card divide-y divide-gray-100 p-0">
          {d.recent.map((a) => (
            <Link key={a.id} to={`/admin/appointments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50">
              <div><p className="font-medium">{a.customer?.full_name}</p><p className="text-sm text-gray-500">{a.service?.name} · {formatAmount(a.amount)}</p></div>
              <p className="text-sm">{formatDate(a.appointment_date)}, {formatTime(a.start_time)}<br /><span className="text-xs text-gray-500">Booked {formatDateTime(a.created_at)}</span></p>
              <StatusBadge status={a.appointment_status} />
            </Link>))}
        </div>)}
      <p className="mt-2 text-right text-sm"><Link to="/admin/appointments" className="text-navy underline">View all appointments</Link></p>

      <h2 className="mb-1 mt-8 text-xl">Monthly revenue</h2>
      <p className="mb-3 text-xs text-gray-500">Counts appointments with status payment verified, confirmed or completed, grouped by appointment month. Pending, cancelled and price-on-request bookings are excluded.</p>
      {rev.loading && !rev.data ? <Spinner /> : rev.error || !rev.data ? <ErrorState message={rev.error ?? 'Unable to load revenue'} onRetry={() => void rev.reload()} /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Month</th><th className="px-4 py-3">Bookings</th><th className="px-4 py-3">Revenue</th><th className="w-1/3 px-4 py-3"><span className="sr-only">Share</span></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {[...rev.data.months].reverse().map((m) => (
                <tr key={m.month}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{monthLabel(m.month)}</td><td className="px-4 py-2">{m.bookings}</td><td className="whitespace-nowrap px-4 py-2">{formatRupees(m.revenue)}</td>
                  <td className="px-4 py-2"><div className="h-2 rounded bg-gray-100"><div className="h-2 rounded bg-gold" style={{ width: `${(m.revenue / max) * 100}%` }} /></div></td>
                </tr>))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold"><tr><td className="px-4 py-3">Last 12 months</td><td className="px-4 py-3">{rev.data.bookings}</td><td className="px-4 py-3">{formatRupees(rev.data.total)}</td><td /></tr></tfoot>
          </table>
        </div>)}

      <h2 className="mb-3 mt-8 text-xl">Upcoming appointments</h2>
      {!d.upcoming.length ? <EmptyState title="No upcoming appointments." /> : (
        <div className="card divide-y divide-gray-100 p-0">
          {d.upcoming.map((a) => (
            <Link key={a.id} to={`/admin/appointments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50">
              <div><p className="font-medium">{a.customer?.full_name}</p><p className="text-sm text-gray-500">{a.service?.name}</p></div>
              <p className="text-sm">{formatDate(a.appointment_date)}, {formatTime(a.start_time)}</p><StatusBadge status={a.appointment_status} />
            </Link>))}
        </div>)}
    </>
  );
}