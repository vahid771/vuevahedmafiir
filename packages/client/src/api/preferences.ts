import { apiUrl, authHeaders } from './base';

export type CalendarType = 'miladi' | 'shamsi';
export type LanguageType = 'en' | 'fa';

export interface UserPreferences {
  id: number;
  user_id: number;
  calendar: CalendarType;
  language: LanguageType;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPreferences(token: string): Promise<UserPreferences> {
  const res = await fetch(apiUrl('/api/preferences'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch preferences');
  return res.json();
}

export async function updatePreferences(
  token: string,
  data: { calendar?: CalendarType; language?: LanguageType; country?: string | null }
): Promise<UserPreferences> {
  const res = await fetch(apiUrl('/api/preferences'), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}
