import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGoogleLoginUrl } from '../api/auth';

// ── Feature data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: 'Tasks & Groups',
    desc: 'Organise work into groups, set priorities and due dates, sync with Google Tasks and Google Calendar.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Reminders',
    desc: 'Never miss a deadline. Set one-off reminders with optional notes and sync them to Google Calendar.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Habits & Streaks',
    desc: 'Build daily and weekly habits. Track streaks, visualise completion rates, and get AI-suggested habits.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Bills, Subscriptions & Loans',
    desc: 'Track recurring payments, subscription renewals, and loan repayment progress all in one place.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Important Dates',
    desc: 'Remember birthdays, anniversaries and yearly events. Syncs to Google Calendar automatically.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Documents',
    desc: 'Upload and organise files with tags. Backed up to Google Drive so you never lose anything.',
    color: 'bg-teal-50 text-teal-600',
  },
];

const HIGHLIGHTS = [
  {
    icon: '🌍',
    title: '12 Languages',
    desc: 'Full UI in English, Persian, Arabic, Chinese, Hindi, Spanish, French, German, Portuguese, Russian, Turkish, Indonesian.',
  },
  {
    icon: '📅',
    title: '7 Calendar Systems',
    desc: 'Gregorian, Jalali (Shamsi), Hijri (Qamari), Hebrew, Chinese, Saka, and Ethiopian — all in parallel.',
  },
  {
    icon: '🎉',
    title: 'Official Holidays',
    desc: 'Import public holidays for any country. AI translates every holiday name into your active language.',
  },
  {
    icon: '🤖',
    title: 'AI Weekly Summary',
    desc: 'Powered by Groq. Summarises your week, suggests habits, and keeps you ahead of upcoming events.',
  },
  {
    icon: '🔗',
    title: 'Google Workspace',
    desc: 'One-click sync with Google Tasks, Google Calendar, and Google Drive.',
  },
  {
    icon: '🗺️',
    title: 'World Map Location',
    desc: 'Pick your country on an interactive SVG world map to personalise holidays and weekends.',
  },
];

// ── Google logo SVG (reused) ──────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppLogo({ size = 7 }: { size?: number }) {
  const s = size * 4; // tailwind w-N = N*4px
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style={{ width: s, height: s }} className="shrink-0">
      <rect width="32" height="32" rx="7" fill="#3b82f6"/>
      <rect x="6" y="10" width="20" height="17" rx="2" fill="white"/>
      <rect x="6" y="10" width="20" height="6" rx="2" fill="#1d4ed8"/>
      <rect x="10" y="6" width="3" height="6" rx="1.5" fill="white"/>
      <rect x="19" y="6" width="3" height="6" rx="1.5" fill="white"/>
      <rect x="9" y="20" width="4" height="4" rx="1" fill="#3b82f6"/>
      <rect x="14" y="20" width="4" height="4" rx="1" fill="#3b82f6"/>
      <rect x="19" y="20" width="4" height="4" rx="1" fill="#3b82f6"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { token } = useAuth();

  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AppLogo size={7} />
            <span className="font-bold text-gray-800 text-sm">Life Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {token ? (
              <Link to="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:block">
                  Sign In
                </Link>
                <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
          Free · Open · Private
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
          One dashboard for<br />
          <span className="text-blue-600">your entire life</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Tasks, habits, bills, reminders, important dates, and documents — all in one place,
          in your language, in your calendar system, with AI insights.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {token ? (
            <Link to="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl text-base transition-colors shadow-sm shadow-blue-200">
              Open Dashboard →
            </Link>
          ) : (
            <>
              <a
                href={getGoogleLoginUrl()}
                className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl text-base transition-colors shadow-sm"
              >
                <GoogleLogo />
                Continue with Google
              </a>
              <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl text-base transition-colors shadow-sm shadow-blue-200">
                Sign Up with Email
              </Link>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card required. Free forever.</p>
      </section>

      {/* ── Features grid ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything you need, nothing you don't</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Six focused modules that cover the full picture of your personal and professional life.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Highlights strip ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Built for everyone, everywhere</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Language, calendar, and localisation are first-class citizens — not afterthoughts.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {HIGHLIGHTS.map(h => (
              <div key={h.title} className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <span className="text-2xl shrink-0 mt-0.5">{h.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{h.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI callout ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-white overflow-hidden relative">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-16 -left-8 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-semibold px-3 py-1 rounded-full mb-5 border border-white/20">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Powered by Groq AI
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
              Your personal AI assistant knows your week
            </h2>
            <p className="text-blue-100 text-base leading-relaxed mb-6">
              Every week, the AI reads your tasks, habits, bills, reminders, and upcoming dates — then writes
              a personalised summary in your language. Edit it, save it, restore past versions.
              It also suggests new habits based on what you already track.
            </p>
            <ul className="space-y-2 text-sm text-blue-100 mb-8">
              {[
                'Weekly summary in 12 languages',
                'Habit suggestions tailored to your activity',
                'AI-translated holiday names for any country',
              ].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            {!token && (
              <Link to="/login" className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-blue-50 transition-colors">
                Try it free →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Connects with Google Workspace</h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-10">
            Sign in with Google and optionally connect individual services. You stay in control of exactly what's synced.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'Google Tasks',    desc: 'Sync task lists & items' },
              { name: 'Google Calendar', desc: 'Reminders, dates & tasks' },
              { name: 'Google Drive',    desc: 'Document backup & download' },
            ].map(g => (
              <div key={g.name} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm min-w-[200px]">
                <GoogleLogo />
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">{g.name}</p>
                  <p className="text-xs text-gray-400">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      {!token && (
        <section className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Ready to take control?</h2>
          <p className="text-gray-500 text-lg mb-8 max-w-md mx-auto">Join in seconds. No credit card, no ads, no tracking.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={getGoogleLoginUrl()}
              className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl text-base transition-colors shadow-sm"
            >
              <GoogleLogo />
              Continue with Google
            </a>
            <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl text-base transition-colors shadow-sm shadow-blue-200">
              Sign Up with Email
            </Link>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <AppLogo size={5} />
            <span>Life Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <Link to="/login" className="hover:text-gray-600 transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
