import { apiUrl, authHeaders } from './base';

export type CalendarType = 'miladi' | 'shamsi' | 'qamari' | 'hebrew' | 'chinese' | 'saka' | 'ethiopian';
export type LanguageType = 'en' | 'fa' | 'ar' | 'zh' | 'hi' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'tr' | 'id';

export interface UserPreferences {
  id: number;
  user_id: number;
  calendar: CalendarType;
  language: LanguageType;
  country: string | null;
  secondary_calendar: CalendarType | null;
  tertiary_calendar: CalendarType | null;
  timezone: string | null;
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
  data: {
    calendar?: CalendarType; language?: LanguageType; country?: string | null;
    secondary_calendar?: CalendarType | null; tertiary_calendar?: CalendarType | null;
    timezone?: string | null;
  }
): Promise<UserPreferences> {
  const res = await fetch(apiUrl('/api/preferences'), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}
