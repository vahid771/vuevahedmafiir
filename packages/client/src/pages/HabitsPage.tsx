import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  logHabit,
  unlogHabit,
  type Habit,
} from '../api/habits';
import { getWeekDates } from '../utils/dates';
import HabitForm, { type HabitFormState, EMPTY_HABIT_FORM } from '../components/habits/HabitForm';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HabitsPage() {
  const { token } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editInitial, setEditInitial] = useState<HabitFormState>(EMPTY_HABIT_FORM);
  const [saving, setSaving] = useState(false);

  const weekDates = getWeekDates();

  async function load() {
    try {
      setLoading(true);
      setHabits(await getHabits(token!));
    } catch {
      setError('Failed to load habits');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startAdd() { setEditId(null); setEditInitial(EMPTY_HABIT_FORM); setShowForm(true); }
  function startEdit(h: Habit) { setEditId(h.id); setEditInitial({ name: h.name, frequency: h.frequency }); setShowForm(true); }
  function cancelForm() { setShowForm(false); setEditId(null); }

  async function handleSave(form: HabitFormState) {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId !== null) {
        await updateHabit(token!, editId, form);
      } else {
        await createHabit(token!, form);
      }
      cancelForm();
      await load();
    } catch {
      setError('Failed to save habit');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this habit and all its logs?')) return;
    try {
      await deleteHabit(token!, id);
      await load();
    } catch {
      setError('Failed to delete habit');
    }
  }

  async function toggleLog(habit: Habit, date: string) {
    const isLogged = habit.logs_this_week.includes(date);
    try {
      if (isLogged) {
        await unlogHabit(token!, habit.id, date);
      } else {
        await logHabit(token!, habit.id);
      }
      await load();
    } catch {
      setError('Failed to update log');
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Habits</h1>
        <button onClick={startAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Add Habit</button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {showForm && (
        <HabitForm
          initial={editInitial}
          onSave={handleSave}
          onCancel={cancelForm}
          saving={saving}
          editId={editId}
        />
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : habits.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No habits yet.</p>
          <p className="text-sm mt-1">Click "+ Add Habit" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => (
            <div key={habit.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-gray-900">{habit.name}</span>
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{habit.frequency}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-orange-500 font-medium">{habit.current_streak} day streak</span>
                  <button onClick={() => startEdit(habit)} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Edit</button>
                  <button onClick={() => handleDelete(habit.id)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50">Del</button>
                </div>
              </div>
              <div className="flex gap-2">
                {weekDates.map((date, i) => {
                  const logged = habit.logs_this_week.includes(date);
                  const isToday = date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={date} className="flex flex-col items-center gap-1 flex-1">
                      <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{DAYS[i]}</span>
                      <button
                        onClick={() => toggleLog(habit, date)}
                        className={`w-8 h-8 rounded-full border-2 transition-colors ${logged ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}
                        title={date}
                      >
                        {logged && <span className="text-white text-xs">✓</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
