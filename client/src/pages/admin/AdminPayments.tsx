import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AppointmentTable, type AdminApptRow } from '../../components/AppointmentTable';
import { EmptyState, ErrorState, PageTitle, Spinner } from '../../components/ui';

const TABS = [['submitted', 'Awaiting verification'], ['verified', 'Verified'], ['rejected', 'Rejected']] as const;
export default function AdminPayments() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('submitted');
  const q = useAsync(() => api<{ items: AdminApptRow[] }>(`/admin/appointments?payment_status=${tab}&page_size=50&sort=asc`), [tab]);
  return (
    <>
      <PageTitle title="Payments" subtitle="Open an appointment to view the screenshot and verify or reject the payment." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[40px] rounded-full border px-4 text-sm ${tab === k ? 'border-gold bg-gold font-semibold text-navy-dark' : 'border-gray-300 bg-white'}`}>{l}</button>)}</div>
      {q.loading ? <Spinner /> : q.error ? <ErrorState message={q.error} onRetry={() => void q.reload()} /> : !q.data?.items.length ? <EmptyState title={tab === 'submitted' ? 'No pending payment verifications.' : 'Nothing here yet.'} /> : <AppointmentTable items={q.data.items} />}
    </>
  );
}
