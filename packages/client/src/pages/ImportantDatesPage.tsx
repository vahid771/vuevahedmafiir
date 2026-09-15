import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import {
  getDates,
  createDate,
  updateDate,
  deleteDate,
  type ImportantDate,
} from '../api/dates';
import { formatDate } from '../utils/format';
import DateForm, { type DateFormState, EMPTY_DATE_FORM } from '../components/dates/DateForm';
import { getGoogleCalendarStatus, syncFromGoogleCalendar } from '../api/googleCalendar';
import { useSyncQueue } from '../context/SyncQueueContext';

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function daysLabel(n: number): string {
  if (n === 0) return 'Today!';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${Math.abs(n)} days ago`;
  return `in ${n} days`;
}

export default function ImportantDatesPage() {
  const { token } = useAuth();
  const { calendar } = useCalendar();
  const { addJob } = useSyncQueue();
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editInitial, setEditInitial] = useState<DateFormState>(EMPTY_DATE_FORM);
  const [saving, setSaving] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

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
      setDates(result.dates as ImportantDate[]);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch {
      setError('Failed to sync from Google Calendar');
    } finally {
      setSyncing(false);
    }
  }

  function startAdd() { setEditId(null); setEditInitial(EMPTY_DATE_FORM); setShowForm(true); }
  function startEdit(d: ImportantDate) {
    setEditId(d.id);
    setEditInitial({ title: d.title, date: d.date, recurs_yearly: !!d.recurs_yearly, notes: d.notes ?? '' });
    setShowForm(true);
  }
  function cancelForm() { setShowForm(false); setEditId(null); }

  async function handleSave(form: DateFormState) {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const payload = { title: form.title, date: form.date, recurs_yearly: form.recurs_yearly ? 1 : 0, notes: form.notes || null };
      if (editId !== null) {
        await (gcalConnected
          ? addJob(`Update "${form.title}" on Google Calendar`, () => updateDate(token!, editId, payload).then(() => {}))
          : updateDate(token!, editId, payload));
      } else {
        await (gcalConnected
          ? addJob(`Add "${form.title}" to Google Calendar`, () => createDate(token!, payload).then(() => {}))
          : createDate(token!, payload));
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
      await (gcalConnected
        ? addJob(`Delete date from Google Calendar`, () => deleteDate(token!, id).then(() => {}))
        : deleteDate(token!, id));
      await load();
    } catch {
      setError('Failed to delete date');
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Important Dates</h1>
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
          <button onClick={startAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Add Date</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {showForm && (
        <DateForm
          initial={editInitial}
          onSave={handleSave}
          onCancel={cancelForm}
          saving={saving}
          editId={editId}
        />
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
                  <p className="text-sm text-gray-500 mt-0.5">{formatDate(d.date, calendar)} — <span className={isSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}>{daysLabel(days)}</span></p>
                  {d.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button onClick={() => startEdit(d)} title="Edit" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(d.id)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
