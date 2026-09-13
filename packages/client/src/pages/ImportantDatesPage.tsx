import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getDates,
  createDate,
  updateDate,
  deleteDate,
  type ImportantDate,
} from '../api/dates';

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function daysLabel(n: number): string {
  if (n === 0) return 'Today!';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${Math.abs(n)} days ago`;
  return `in ${n} days`;
}

interface FormState { title: string; date: string; recurs_yearly: boolean; notes: string; }
const EMPTY: FormState = { title: '', date: '', recurs_yearly: false, notes: '' };

export default function ImportantDatesPage() {
  const { token } = useAuth();
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setDates(await getDates(token!));
    } catch {
      setError('Failed to load dates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startAdd() { setEditId(null); setForm(EMPTY); setShowForm(true); }
  function startEdit(d: ImportantDate) {
    setEditId(d.id);
    setForm({ title: d.title, date: d.date, recurs_yearly: !!d.recurs_yearly, notes: d.notes ?? '' });
    setShowForm(true);
  }
  function cancelForm() { setShowForm(false); setEditId(null); setForm(EMPTY); }

  async function handleSave() {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const payload = { title: form.title, date: form.date, recurs_yearly: form.recurs_yearly ? 1 : 0, notes: form.notes || null };
      if (editId !== null) {
        await updateDate(token!, editId, payload);
      } else {
        await createDate(token!, payload);
      }
      cancelForm();
      await load();
    } catch {
      setError('Failed to save date');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this date?')) return;
    try {
      await deleteDate(token!, id);
      await load();
    } catch {
      setError('Failed to delete date');
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Important Dates</h1>
        <button onClick={startAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Add Date</button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">{editId ? 'Edit Date' : 'New Date'}</h2>
          <div className="space-y-3">
            <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.recurs_yearly} onChange={e => setForm(p => ({ ...p, recurs_yearly: e.target.checked }))} />
              Recurs yearly
            </label>
            <textarea className="w-full border border-gray-300 rounded px-3 py-2 text-sm" rows={2} placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button onClick={cancelForm} className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : dates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No important dates yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dates.map(d => {
            const days = daysUntil(d.next_occurrence);
            const isPast = days < 0 && !d.recurs_yearly;
            const isSoon = days >= 0 && days <= 7;
            const isUpcoming = days >= 0 && days <= 30;
            let rowClass = 'bg-white border-gray-200';
            if (isPast) rowClass = 'bg-gray-50 border-gray-200 opacity-60';
            else if (isSoon) rowClass = 'bg-amber-50 border-amber-300';
            else if (isUpcoming) rowClass = 'bg-blue-50 border-blue-200';
            return (
              <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg border ${rowClass}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{d.title}</span>
                    {d.recurs_yearly ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Yearly</span> : null}
                    {isSoon && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Soon</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{formatDate(d.date)} — <span className={isSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}>{daysLabel(days)}</span></p>
                  {d.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button onClick={() => startEdit(d)} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Edit</button>
                  <button onClick={() => handleDelete(d.id)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50">Del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
