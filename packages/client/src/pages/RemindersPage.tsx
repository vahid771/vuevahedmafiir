import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  type Reminder,
} from '../api/reminders';
import { formatDateTime } from '../utils/format';
import DateTimeInput from '../components/DateTimeInput';

interface FormState { title: string; remind_at: string; notes: string; }
const EMPTY: FormState = { title: '', remind_at: '', notes: '' };

function reminderToForm(r: Reminder): FormState {
  // datetime-local input needs YYYY-MM-DDTHH:MM
  const d = new Date(r.remind_at);
  const local = isNaN(d.getTime())
    ? r.remind_at
    : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { title: r.title, remind_at: local, notes: r.notes ?? '' };
}

export default function RemindersPage() {
  const { token } = useAuth();
  const { calendar } = useCalendar();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setReminders(await getReminders(token!));
    } catch {
      setError('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const now = new Date();
  const overdue = reminders.filter(r => !r.done && new Date(r.remind_at) < now);
  const upcoming = reminders.filter(r => !r.done && new Date(r.remind_at) >= now);
  const completed = reminders.filter(r => r.done);

  function startAdd() { setEditId(null); setForm(EMPTY); setShowForm(true); }
  function startEdit(r: Reminder) { setEditId(r.id); setForm(reminderToForm(r)); setShowForm(true); }
  function cancelForm() { setShowForm(false); setEditId(null); setForm(EMPTY); }

  async function handleSave() {
    if (!form.title.trim() || !form.remind_at) return;
    setSaving(true);
    try {
      const payload = { ...form, notes: form.notes || null };
      if (editId !== null) {
        await updateReminder(token!, editId, payload);
      } else {
        await createReminder(token!, payload);
      }
      cancelForm();
      await load();
    } catch {
      setError('Failed to save reminder');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(r: Reminder) {
    try {
      await updateReminder(token!, r.id, { done: r.done ? 0 : 1 });
      await load();
    } catch {
      setError('Failed to update reminder');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this reminder?')) return;
    try {
      await deleteReminder(token!, id);
      await load();
    } catch {
      setError('Failed to delete reminder');
    }
  }

  function ReminderRow({ r, overdue: isOverdue }: { r: Reminder; overdue?: boolean }) {
    return (
      <div className={`flex items-start justify-between p-3 rounded-lg border ${isOverdue ? 'border-l-4 border-l-red-500 bg-red-50' : 'bg-white border-gray-200'}`}>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-gray-900 ${r.done ? 'line-through text-gray-400' : ''}`}>{r.title}</p>
          <p className={`text-sm mt-0.5 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>{formatDateTime(r.remind_at, calendar)}</p>
          {r.notes && <p className="text-sm text-gray-400 mt-0.5 truncate">{r.notes}</p>}
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <button onClick={() => toggleDone(r)} className={`text-xs px-2 py-1 rounded border ${r.done ? 'border-gray-300 text-gray-500' : 'border-green-400 text-green-700 hover:bg-green-50'}`}>
            {r.done ? 'Undo' : 'Done'}
          </button>
          <button onClick={() => startEdit(r)} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Edit</button>
          <button onClick={() => handleDelete(r.id)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50">Del</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
        <button onClick={startAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Add Reminder</button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">{editId ? 'Edit Reminder' : 'New Reminder'}</h2>
          <div className="space-y-3">
            <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <DateTimeInput value={form.remind_at} onChange={v => setForm(p => ({ ...p, remind_at: v }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
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
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">Overdue</h2>
              <div className="space-y-2">{overdue.map(r => <ReminderRow key={r.id} r={r} overdue />)}</div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming</h2>
            {upcoming.length === 0
              ? <p className="text-gray-400 text-sm">No upcoming reminders.</p>
              : <div className="space-y-2">{upcoming.map(r => <ReminderRow key={r.id} r={r} />)}</div>
            }
          </section>

          {completed.length > 0 && (
            <section>
              <button onClick={() => setShowCompleted(s => !s)} className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 hover:text-gray-600">
                Completed ({completed.length}) {showCompleted ? '▲' : '▼'}
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-2 opacity-60">{completed.map(r => <ReminderRow key={r.id} r={r} />)}</div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
