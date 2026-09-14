import { apiUrl, authHeaders } from './base';

export async function getSummary(token: string): Promise<string> {
  const res = await fetch(apiUrl('/api/ai/summary'), { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to generate summary');
  }
  const data = await res.json() as { summary: string };
  return data.summary;
}
