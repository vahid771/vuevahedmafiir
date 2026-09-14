import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSummary } from '../api/ai';
import CalendarWidget from '../components/CalendarWidget';

function renderSummary(text: string) {
  // Simple markdown-ish: split on double newlines for paragraphs, bold **text**
  return text.split(/\n\n+/).map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) => {
      if (chunk.startsWith('**') && chunk.endsWith('**')) {
        return <strong key={j}>{chunk.slice(2, -2)}</strong>;
      }
      // Handle single newlines within a paragraph as line breaks
      return chunk.split('\n').map((line, k, arr) => (
        <span key={`${j}-${k}`}>{line}{k < arr.length - 1 && <br />}</span>
      ));
    });
    return <p key={i} className="mb-3 text-gray-700 leading-relaxed">{parts}</p>;
  });
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSummarize() {
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const result = await getSummary(token!);
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">Here's your personal life dashboard.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Weekly Summary</h2>
            <p className="text-sm text-gray-500 mt-0.5">What needs your attention this week?</p>
          </div>
          <button
            onClick={handleSummarize}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-4"
          >
            {loading ? 'Thinking...' : 'Summarize my week'}
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-6 text-gray-500">
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Generating your summary…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {summary && !loading && (
          <div className="mt-2 text-sm">
            {renderSummary(summary)}
          </div>
        )}

        {!summary && !loading && !error && (
          <p className="text-sm text-gray-400 italic">
            Click "Summarize my week" to get a personalized briefing powered by GPT-4o-mini.
          </p>
        )}
      </div>

      <div className="mt-6">
        <CalendarWidget />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: 'Tasks', href: '/tasks', icon: '✓', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Bills & Subs', href: '/bills', icon: '$', color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Reminders', href: '/reminders', icon: '🔔', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'Habits', href: '/habits', icon: '◎', color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: 'Dates', href: '/dates', icon: '📅', color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { label: 'Documents', href: '/documents', icon: '📁', color: 'bg-gray-50 border-gray-200 text-gray-700' },
        ].map(({ label, href, icon, color }) => (
          <a key={label} href={href} className={`flex items-center gap-3 p-4 rounded-xl border ${color} hover:opacity-80 transition-opacity`}>
            <span className="text-xl">{icon}</span>
            <span className="font-medium text-sm">{label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
