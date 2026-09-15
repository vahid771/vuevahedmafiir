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
import ReminderForm, { type ReminderFormState, EMPTY_REMINDER_FORM } from '../components/reminders/ReminderForm';
import { getGoogleCalendarStatus, syncFromGoogleCalendar } from '../api/googleCalendar';
import { useSyncQueue } from '../context/SyncQueueContext';

function reminderToForm(r: Reminder): ReminderFormState {
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
  const { addJob } = useSyncQueue();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editInitial, setEditInitial] = useState<ReminderFormState>(EMPTY_REMINDER_FORM);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

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

  useEffect(() => {
    if (!token) return;
    getGoogleCalendarStatus(token)
      .then(s => setGcalConnected(s.connected))
      .catch(() => { /* non-fatal */ });
  }, [token]);

  async function handleCalendarSync() {
    if (!token) return;
    setSyncing(true);
    setSyncSuccess(false);
    setError('');
    try {
      const result = await syncFromGoogleCalendar(token);
      setReminders(result.reminders as Reminder[]);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch {
      setError('Failed to sync from Google Calendar');
    } finally {
      setSyncing(false);
    }
  }

  const now = new Date();
  const overdue = reminders.filter(r => !r.done && new Date(r.remind_at) < now);
  const upcoming = reminders.filter(r => !r.done && new Date(r.remind_at) >= now);
  const completed = reminders.filter(r => r.done);

  function startAdd() { setEditId(null); setEditInitial(EMPTY_REMINDER_FORM); setShowForm(true); }
  function startEdit(r: Reminder) { setEditId(r.id); setEditInitial(reminderToForm(r)); setShowForm(true); }
  function cancelForm() { setShowForm(false); setEditId(null); }

  async function handleSave(form: ReminderFormState) {
    if (!form.title.trim() || !form.remind_at) return;
    setSaving(true);
    try {
      const payload = { ...form, notes: form.notes || null };
      if (editId !== null) {
        await (gcalConnected
          ? addJob(`Update "${form.title}" on Google Calendar`, () => updateReminder(token!, editId, payload).then(() => {}))
          : updateReminder(token!, editId, payload));
      } else {
        await (gcalConnected
          ? addJob(`Add "${form.title}" to Google Calendar`, () => createReminder(token!, payload).then(() => {}))
          : createReminder(token!, payload));
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
      await (gcalConnected
        ? addJob(`Update "${r.title}" on Google Calendar`, () => updateReminder(token!, r.id, { done: r.done ? 0 : 1 }).then(() => {}))
        : updateReminder(token!, r.id, { done: r.done ? 0 : 1 }));
      await load();
    } catch {
      setError('Failed to update reminder');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this reminder?')) return;
    try {
      await (gcalConnected
        ? addJob(`Delete reminder from Google Calendar`, () => deleteReminder(token!, id).then(() => {}))
        : deleteReminder(token!, id));
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
        <div className="flex items-center gap-1 ml-3 shrink-0">
          <button onClick={() => toggleDone(r)} title={r.done ? 'Undo' : 'Mark done'} className={`p-1.5 rounded transition-colors ${r.done ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}>
            {r.done ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => handleDelete(r.id)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
        <div className="flex items-center gap-2">
          {gcalConnected && (
            <button
              type="button"
              onClick={handleCalendarSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Sync from Google Calendar"
            >
              {syncing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
              ) : syncSuccess ? (
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {syncing ? 'Syncing…' : syncSuccess ? 'Synced' : 'Sync from Google'}
            </button>
          )}
          <button onClick={startAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Add Reminder</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {showForm && (
        <>
          <h2 className="font-semibold text-gray-800 mb-3">{editId ? 'Edit Reminder' : 'New Reminder'}</h2>
          <ReminderForm
            initial={editInitial}
            onSave={handleSave}
            onCancel={cancelForm}
            saving={saving}
          />
        </>
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
