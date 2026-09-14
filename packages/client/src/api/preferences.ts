import { apiUrl, authHeaders } from './base';

export type CalendarType = 'miladi' | 'shamsi';

export interface UserPreferences {
  id: number;
  user_id: number;
  calendar: CalendarType;
  created_at: string;
  updated_at: string;
}

export async function getPreferences(token: string): Promise<UserPreferences> {
  const res = await fetch(apiUrl('/api/preferences'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch preferences');
  return res.json();
}

export async function updatePreferences(token: string, data: { calendar: CalendarType }): Promise<UserPreferences> {
  const res = await fetch(apiUrl('/api/preferences'), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}
