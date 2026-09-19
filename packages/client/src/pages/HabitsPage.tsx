import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useCalendar } from '../context/CalendarContext';
import HabitsCharts from '../components/charts/HabitsCharts';
import {
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  logHabit,
  unlogHabit,
  type Habit,
} from '../api/habits';
import { getHabitSuggestions } from '../api/ai';
import { getWeekDates, getShamsiWeekDates } from '../utils/dates';
import HabitForm, { type HabitFormState, EMPTY_HABIT_FORM } from '../components/habits/HabitForm';

export default function HabitsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const { calendar } = useCalendar();
  const isShamsi = calendar === 'shamsi';
  const DAYS      = t(isShamsi ? 'habits.daysShamsi'      : 'habits.days',      { returnObjects: true }) as string[];
  const DAYS_SHORT = t(isShamsi ? 'habits.daysShamsiShort' : 'habits.daysShort', { returnObjects: true }) as string[];
  // Days elapsed so far this week (1-7), used for completion % calculation
  const daysSoFar = isShamsi
    ? (() => { const d = new Date().getDay(); return d === 6 ? 1 : d + 2; })()
    : (() => { const d = new Date().getDay(); return d === 0 ? 7 : d; })();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editInitial, setEditInitial] = useState<HabitFormState>(EMPTY_HABIT_FORM);
  const [saving, setSaving] = useState(false);

  // AI suggestions
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');

  const weekDates = isShamsi ? getShamsiWeekDates() : getWeekDates();

  async function load() {
    try {
      setLoading(true);
      setHabits(await getHabits(token!));
    } catch {
      setError(t('habits.failedLoad'));
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
      setError(t('habits.failedSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('habits.deleteConfirm'))) return;
    try {
      await deleteHabit(token!, id);
      await load();
    } catch {
      setError(t('habits.failedDelete'));
    }
  }

  async function handleGetSuggestions() {
    setSuggestionsLoading(true);
    setSuggestionsError('');
    try {
      const results = await getHabitSuggestions(token!, lang);
      setSuggestions(results);
    } catch (e: unknown) {
      setSuggestionsError(e instanceof Error ? e.message : t('habits.failedLoad'));
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function handleAddSuggestion(name: string) {
    try {
      await createHabit(token!, { name, frequency: 'daily' });
      setSuggestions(prev => prev.filter(s => s !== name));
      await load();
    } catch {
      setError(t('habits.failedAdd'));
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
      setError(t('habits.failedLog'));
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('habits.title')}</h1>
        <button onClick={startAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{t('habits.addHabit')}</button>
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
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : habits.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">{t('habits.noHabits')}</p>
          <p className="text-sm mt-1">{t('habits.noHabitsHint')}</p>
        </div>
      ) : (
        <motion.ul
          className="space-y-4 list-none p-0"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {habits.map(habit => (
            <motion.li
              key={habit.id}
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } } }}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-gray-900" dir="auto">
                    {(lang === 'fa' ? habit.name_fa : habit.name_en) || habit.name}
                  </span>
                  <span className="ms-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full" dir="auto">
                    {habit.frequency === 'daily' ? t('habits.form.daily') : t('habits.form.weekly')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-orange-500 font-medium" dir="auto">{habit.current_streak} {t('habits.dayStreak')}</span>
                  <button onClick={() => startEdit(habit)} title={t('common.edit')} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(habit.id)} title={t('common.delete')} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5">
                {weekDates.map((date, i) => {
                  const logged = habit.logs_this_week.includes(date);
                  const isToday = date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={date} className="flex flex-col items-center gap-1 flex-1 min-w-0" title={`${DAYS[i]} — ${date}`}>
                      <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                        {DAYS_SHORT[i]}
                      </span>
                      <button
                        onClick={() => toggleLog(habit, date)}
                        className={`w-8 h-8 rounded-full border-2 transition-colors ${logged ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}
                        title={`${DAYS[i]} — ${date}`}
                      >
                        {logged && <span className="text-white text-xs">✓</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {/* Charts */}
      {!loading && habits.length > 0 && (
        <HabitsCharts habits={habits} daysSoFar={daysSoFar} lang={lang} />
      )}

      {/* AI Suggested Habits */}
      <div className="mt-6 border border-gray-200 rounded-lg bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setSuggestionsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-1.043 1.022l-.48.316a1.5 1.5 0 01-.837.255H9.966a1.5 1.5 0 01-.837-.255l-.48-.316a3.75 3.75 0 01-1.044-1.021l-.347-.347z" />
            </svg>
            {t('habits.suggestedHabits')}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${suggestionsOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {suggestionsOpen && (
            <motion.div
              key="suggestions-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' as const } }}
              style={{ overflow: 'hidden' }}
              className="px-4 pb-4 border-t border-gray-100 space-y-3 pt-3"
            >
              <button
                type="button"
                onClick={handleGetSuggestions}
                disabled={suggestionsLoading}
                className="text-sm px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {suggestionsLoading ? t('habits.gettingSuggestions') : t('habits.getSuggestions')}
              </button>

              {suggestionsError && (
                <p className="text-sm text-red-600">{suggestionsError}</p>
              )}

              {!suggestionsLoading && suggestions.length > 0 && (
                <ul className="space-y-2">
                  {suggestions.map(name => (
                    <li key={name} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-sm text-gray-800" dir="auto">{name}</span>
                      <button
                        type="button"
                        onClick={() => handleAddSuggestion(name)}
                        className="text-xs px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors shrink-0"
                      >
                        {t('habits.addSuggestion')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!suggestionsLoading && suggestions.length === 0 && !suggestionsError && (
                <p className="text-sm text-gray-400">{t('habits.suggestionsPlaceholder')}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
