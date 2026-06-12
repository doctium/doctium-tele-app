'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';

interface SuggestedService {
  id: string; name: string; description: string; createdAt: string;
  doctor?: { name: string; designation?: string };
}

export default function SuggestedServicesPage() {
  const [services, setServices] = useState<SuggestedService[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiClient.get('/admin/suggested-services').then((r: unknown) => setServices((r as { data: SuggestedService[] }).data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleApprove = async (s: SuggestedService) => {
    await apiClient.post('/admin/services', { name: s.name });
    await apiClient.delete(`/admin/suggested-services/${s.id}`);
    toast.success(`"${s.name}" approved & added to services`);
    load();
  };

  const handleReject = async (id: string) => {
    await apiClient.delete(`/admin/suggested-services/${id}`);
    toast.success('Suggestion rejected');
    load();
  };

  const cols: Column<SuggestedService>[] = [
    { key: 'no', header: '#', width: '48px', render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span> },
    { key: 'name', header: 'Service Name', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'description', header: 'Description', render: r => <span className="text-sm text-gray-500">{r.description}</span> },
    { key: 'doctor', header: 'Suggested By', render: r => <span className="text-sm">{r.doctor?.name ?? '—'}</span> },
    { key: 'date', header: 'Date', render: r => <span className="text-gray-400 text-sm">{format(new Date(r.createdAt), 'dd MMM yyyy')}</span> },
    { key: 'actions', header: 'Actions', render: r => (
      <div className="flex gap-2">
        <button onClick={() => handleApprove(r)} className="flex items-center gap-1 text-xs bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium">
          <CheckCircle size={12} /> Approve
        </button>
        <button onClick={() => handleReject(r.id)} className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium">
          <XCircle size={12} /> Reject
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <h1 className="page-title">Suggested Services</h1>
      <div className="card p-0 overflow-hidden">
        <DataTable columns={cols} data={services} keyExtractor={r => r.id} loading={loading} emptyMessage="No service suggestions from doctors" />
      </div>
    </div>
  );
}
