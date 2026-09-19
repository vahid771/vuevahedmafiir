import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSummary, getCachedSummary, updateSummary, type SummaryHistoryEntry } from '../api/ai';
import CalendarWidget from '../components/CalendarWidget';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useCalendar } from '../context/CalendarContext';
import DashboardCharts from '../components/charts/DashboardCharts';
import { getTasks, type Task } from '../api/tasks';
import { getHabits, type Habit } from '../api/habits';
import { getBills, getLoans, type Bill, type Loan } from '../api/bills';

// Per-language localStorage cache
function lsKey(lang: string) { return `ai_summary_cache_${lang}`; }

interface CachedEntry { summary: string; expiresAt: string; generatedAt: string }

function loadLocalCache(lang: string): CachedEntry | null {
  try {
    const raw = localStorage.getItem(lsKey(lang));
    if (!raw) return null;
    return JSON.parse(raw) as CachedEntry;
  } catch { return null; }
}

function saveLocalCache(lang: string, entry: CachedEntry) {
  try { localStorage.setItem(lsKey(lang), JSON.stringify(entry)); } catch { /* ignore */ }
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

function formatDatetime(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function renderSummary(text: string) {
  return text.split(/\n\n+/).map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) => {
      if (chunk.startsWith('**') && chunk.endsWith('**')) {
        return <strong key={j}>{chunk.slice(2, -2)}</strong>;
      }
      return chunk.split('\n').map((line, k, arr) => (
        <span key={`${j}-${k}`}>{line}{k < arr.length - 1 && <br />}</span>
      ));
    });
    return <p key={i} className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed">{parts}</p>;
  });
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const { calendar } = useCalendar();

  const [summary, setSummary] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // History
  const [history, setHistory] = useState<SummaryHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chart data
  const [chartTasks, setChartTasks]   = useState<Task[]>([]);
  const [chartHabits, setChartHabits] = useState<Habit[]>([]);
  const [chartBills, setChartBills]   = useState<Bill[]>([]);
  const [chartLoans, setChartLoans]   = useState<Loan[]>([]);

  // Re-load when language changes — each lang has its own cache
  useEffect(() => {
    setSummary('');
    setExpiresAt('');
    setGeneratedAt('');
    setHistory([]);
    setEditing(false);
    setEditError('');

    const local = loadLocalCache(lang);
    if (local && !isExpired(local.expiresAt)) {
      setSummary(local.summary);
      setExpiresAt(local.expiresAt);
      setGeneratedAt(local.generatedAt);
    }

    if (!token) return;

    getCachedSummary(token, lang).then(cached => {
      if (!cached) return;
      setHistory(cached.history);
      if (cached.summary && !isExpired(cached.expiresAt)) {
        setSummary(cached.summary);
        setExpiresAt(cached.expiresAt);
        setGeneratedAt(cached.generatedAt);
        saveLocalCache(lang, { summary: cached.summary, expiresAt: cached.expiresAt, generatedAt: cached.generatedAt });
      }
    }).catch(() => { /* non-fatal */ });
  }, [token, lang]);

  // Chart data fetch — runs once on mount
  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      getTasks(token),
      getHabits(token),
      getBills(token),
      getLoans(token),
    ]).then(([tasks, habits, bills, loans]) => {
      if (tasks.status   === 'fulfilled') setChartTasks(tasks.value);
      if (habits.status  === 'fulfilled') setChartHabits(habits.value);
      if (bills.status   === 'fulfilled') setChartBills(bills.value);
      if (loans.status   === 'fulfilled') setChartLoans(loans.value);
    });
  }, [token]);

  async function handleSummarize() {
    setLoading(true);
    setError('');
    setEditing(false);
    try {
      const result = await getSummary(token!, lang, calendar);
      // Refresh history after generating new summary
      const cached = await getCachedSummary(token!, lang).catch(() => null);
      if (cached) setHistory(cached.history);
      setSummary(result.summary);
      setExpiresAt(result.expiresAt);
      setGeneratedAt(result.generatedAt);
      saveLocalCache(lang, { summary: result.summary, expiresAt: result.expiresAt, generatedAt: result.generatedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.failedSummary'));
    } finally {
      setLoading(false);
    }
  }

  function handleEditStart() {
    setEditText(summary);
    setEditError('');
    setEditing(true);
    // auto-focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleEditCancel() {
    setEditing(false);
    setEditError('');
  }

  async function handleEditSave() {
    if (!editText.trim()) return;
    setEditSaving(true);
    setEditError('');
    try {
      const result = await updateSummary(token!, lang, editText.trim());
      // Old summary was pushed to history by server; refresh
      const cached = await getCachedSummary(token!, lang).catch(() => null);
      if (cached) setHistory(cached.history);
      setSummary(result.summary);
      setGeneratedAt(result.generatedAt);
      saveLocalCache(lang, { summary: result.summary, expiresAt: expiresAt, generatedAt: result.generatedAt });
      setEditing(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setEditSaving(false);
    }
  }

  function handleRestoreHistory(entry: SummaryHistoryEntry) {
    setSummary(entry.summary);
    setGeneratedAt(entry.createdAt);
    setExpiresAt(entry.expiresAt);
    saveLocalCache(lang, { summary: entry.summary, expiresAt: entry.expiresAt, generatedAt: entry.createdAt });
    setHistoryOpen(false);
    setEditing(false);
  }

  const expired = expiresAt ? isExpired(expiresAt) : false;
  const hasValidCache = summary && !expired;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('dashboard.welcomeBack')}{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Left column ── */}
        <div className="w-full lg:flex-1 min-w-0 space-y-6">

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.aiSummary')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.aiSummarySubtitle')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Edit button — only when there's a summary and not currently editing */}
            {summary && !loading && !editing && (
              <button
                onClick={handleEditStart}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title={t('dashboard.editSummary')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="hidden sm:inline">{t('common.edit')}</span>
              </button>
            )}
            <button
              onClick={handleSummarize}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('dashboard.thinking') : hasValidCache ? t('dashboard.refresh') : t('dashboard.summarizeMyWeek')}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-3 py-6 text-gray-500">
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">{t('dashboard.generatingSummary')}</span>
          </div>
        )}

        {/* Generation error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Summary — view mode */}
        {summary && !loading && !editing && (
          <div className="mt-2 text-sm">
            {renderSummary(summary)}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              {generatedAt && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('dashboard.generatedAt', { date: formatDatetime(generatedAt, lang) })}
                </span>
              )}
              {expiresAt && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                  expired
                    ? 'text-red-500 bg-red-50 border-red-200'
                    : 'text-green-600 bg-green-50 border-green-200'
                }`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {expired
                    ? t('dashboard.expired')
                    : t('dashboard.validUntil', { date: formatDatetime(expiresAt, lang) })}
                </span>
              )}
              {/* History toggle */}
              {history.length > 0 && (
                <button
                  onClick={() => setHistoryOpen(o => !o)}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-auto"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('dashboard.history', { count: history.length })}
                  <svg className={`w-3 h-3 transition-transform ${historyOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {/* History panel */}
            {historyOpen && history.length > 0 && (
              <div className="mt-3 border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                {history.map(entry => (
                  <div key={entry.id} className="p-3 bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-gray-400">{formatDatetime(entry.createdAt, lang)}</span>
                      <button
                        onClick={() => handleRestoreHistory(entry)}
                        className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 font-medium shrink-0"
                      >
                        {t('dashboard.restore')}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {entry.summary.slice(0, 200)}{entry.summary.length > 200 ? '…' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary — edit mode */}
        {editing && !loading && (
          <div className="mt-2 space-y-3">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={10}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              dir={lang === 'fa' ? 'rtl' : 'ltr'}
            />
            {editError && (
              <p className="text-xs text-red-600">{editError}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleEditSave}
                disabled={editSaving || !editText.trim()}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSaving ? t('common.saving') : t('common.save')}
              </button>
              <button
                onClick={handleEditCancel}
                disabled={editSaving}
                className="px-4 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {!summary && !loading && !error && (
          <p className="text-sm text-gray-400 italic">
            {t('dashboard.summaryPlaceholder')}
          </p>
        )}
      </div>

      {/* Quick-nav cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { labelKey: 'dashboard.tasks',     href: '/tasks',     icon: '✓', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { labelKey: 'dashboard.bills',     href: '/bills',     icon: '💳', color: 'bg-green-50 border-green-200 text-green-700' },
          { labelKey: 'dashboard.reminders', href: '/reminders', icon: '🔔', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { labelKey: 'dashboard.habits',    href: '/habits',    icon: '◎', color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { labelKey: 'dashboard.dates',     href: '/dates',     icon: '📅', color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { labelKey: 'dashboard.documents', href: '/documents', icon: '📁', color: 'bg-gray-50 border-gray-200 text-gray-700' },
        ].map(({ labelKey, href, icon, color }) => (
          <a key={labelKey} href={href} className={`flex items-center gap-3 p-4 rounded-xl border ${color} hover:opacity-80 transition-opacity`}>
            <span className="text-xl">{icon}</span>
            <span className="font-medium text-sm">{t(labelKey)}</span>
          </a>
        ))}
      </div>

      {/* Statistical overview */}
      {(chartTasks.length > 0 || chartHabits.length > 0 || chartBills.length > 0 || chartLoans.length > 0) && (
        <DashboardCharts
          tasks={chartTasks}
          habits={chartHabits}
          bills={chartBills}
          loans={chartLoans}
          daysSoFar={(() => { const d = new Date().getDay(); return d === 0 ? 7 : d; })()}
        />
      )}

        </div>{/* end left column */}

        {/* ── Right column: calendar ── */}
        <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0">
          <CalendarWidget />
        </div>

      </div>{/* end two-column flex */}
    </div>
  );
}
