import { apiUrl, authHeaders } from './base';

export interface SummaryResult {
  summary: string;
  expiresAt: string;   // ISO timestamp
  generatedAt: string; // ISO timestamp
  summaryLang: string; // language used to generate ('en' | 'fa')
}

export interface SummaryHistoryEntry {
  id: number;
  summary: string;
  summaryLang: string;
  expiresAt: string;
  createdAt: string;
}

export async function getCachedSummary(
  token: string,
  lang = 'en',
): Promise<(SummaryResult & { history: SummaryHistoryEntry[] }) | null> {
  const res = await fetch(apiUrl(`/api/ai/summary?lang=${lang}`), { headers: authHeaders(token) });
  if (!res.ok) return null;
  const data = await res.json() as {
    summary: string | null;
    expires_at: string | null;
    created_at: string | null;
    summary_lang: string;
    history: { id: number; summary: string; summary_lang: string; expires_at: string; created_at: string }[];
  };
  const history: SummaryHistoryEntry[] = (data.history ?? []).map(h => ({
    id: h.id,
    summary: h.summary,
    summaryLang: h.summary_lang,
    expiresAt: h.expires_at,
    createdAt: h.created_at,
  }));
  if (!data.summary) return { summary: '', expiresAt: '', generatedAt: '', summaryLang: lang, history };
  return {
    summary: data.summary,
    expiresAt: data.expires_at!,
    generatedAt: data.created_at!,
    summaryLang: data.summary_lang ?? lang,
    history,
  };
}

export async function getSummary(token: string, language = 'en', calendar = 'miladi'): Promise<SummaryResult> {
  // Send the client's local date so the server uses the user's timezone, not server UTC
  const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const res = await fetch(apiUrl('/api/ai/summary'), {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, calendar, today: localDate }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to generate summary');
  }
  const data = await res.json() as { summary: string; expires_at: string; created_at: string; summary_lang: string };
  return { summary: data.summary, expiresAt: data.expires_at, generatedAt: data.created_at, summaryLang: data.summary_lang ?? language };
}

export async function updateSummary(token: string, lang: string, summary: string): Promise<SummaryResult> {
  const res = await fetch(apiUrl('/api/ai/summary'), {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang, summary }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to update summary');
  }
  const data = await res.json() as { summary: string; expires_at: string; created_at: string; summary_lang: string };
  return { summary: data.summary, expiresAt: data.expires_at, generatedAt: data.created_at, summaryLang: data.summary_lang };
}

export async function getHabitSuggestions(token: string, language = 'en'): Promise<string[]> {
  const res = await fetch(apiUrl('/api/ai/habit-suggestions'), {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to get habit suggestions');
  }
  const data = await res.json() as { suggestions: string[] };
  return data.suggestions;
}
