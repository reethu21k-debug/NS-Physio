import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime } from '../../lib/format';
import { EmptyState, ErrorState, PageTitle, Spinner } from '../../components/ui';

interface U { id: string; full_name: string; email: string; phone: string | null; role: string; is_active: boolean; created_at: string; appointment_count: number }
export default function AdminUsers() {
  const q = useAsync(() => api<U[]>('/admin/users'));
  if (q.loading) return <Spinner />;
  if (q.error) return <ErrorState message={q.error} onRetry={() => void q.reload()} />;
  if (!q.data?.length) return <EmptyState title="No users yet." />;
  return (
    <>
      <PageTitle title="Users" subtitle="Accounts and passwords are managed by Supabase Auth." />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr>{['Name', 'Email', 'Phone', 'Role', 'Joined', 'Appointments', 'Status'].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">{q.data.map((u) => (
            <tr key={u.id}><td className="px-3 py-3 font-medium">{u.full_name || '—'}</td><td className="px-3 py-3">{u.email}</td><td className="whitespace-nowrap px-3 py-3">{u.phone || '—'}</td>
              <td className="px-3 py-3 capitalize">{u.role}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">{formatDateTime(u.created_at)}</td><td className="px-3 py-3">{u.appointment_count}</td>
              <td className="px-3 py-3">{u.is_active ? 'Active' : 'Disabled'}</td></tr>))}</tbody></table>
      </div>
    </>
  );
}
