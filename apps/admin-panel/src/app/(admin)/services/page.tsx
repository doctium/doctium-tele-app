'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toggle } from '@/components/ui/Toggle';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Avatar } from '@/components/ui/Avatar';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Service } from '@/types';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', image: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiClient.get('/services').then((r: unknown) => setServices((r as { data: Service[] }).data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string, status: boolean) => {
    await apiClient.patch(`/admin/services/${id}`, { status: !status });
    toast.success(status ? 'Service disabled' : 'Service enabled');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    await apiClient.delete(`/admin/services/${id}`);
    toast.success('Service deleted');
    load();
  };

  const handleAdd = async () => {
    if (!form.name) return;
    setSaving(true);
    try { await apiClient.post('/admin/services', form); toast.success('Service created'); setShowAdd(false); setForm({ name: '', image: '' }); load(); }
    catch {}
    finally { setSaving(false); }
  };

  const filtered = search ? services.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) : services;

  const cols: Column<Service>[] = [
    { key: 'no', header: '#', width: '48px', render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span> },
    { key: 'image', header: 'Icon', render: r => <Avatar src={r.image} name={r.name} size={36} /> },
    { key: 'name', header: 'Service Name', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'status', header: 'Active', render: r => <Toggle checked={r.status} onChange={() => handleToggle(r.id, r.status)} /> },
    { key: 'actions', header: '', render: r => <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Services / Categories</h1>
        <div className="flex gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search services..." />
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Service</button>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable columns={cols} data={filtered} keyExtractor={r => r.id} loading={loading} emptyMessage="No services created" />
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Service">
        <div className="space-y-4">
          <div><label className="label">Service Name</label><input className="input" placeholder="e.g. Cardiology" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Icon Image URL</label><input className="input" placeholder="https://..." value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Add Service'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
