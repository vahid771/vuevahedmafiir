import { apiUrl, authHeaders } from './base';

export interface Holiday {
  date: string;       // YYYY-MM-DD
  localName: string;
  name: string;       // English name
  nameFa: string;     // Persian name
  types: string[];
  hidden: boolean;
  isCustom: boolean;
}

export interface WeekendsResponse {
  country: string;
  weekendDays: number[];
  isCustom: boolean;
}

export async function getHolidays(token: string, country: string, year: number): Promise<Holiday[]> {
  const res = await fetch(apiUrl(`/api/holidays?country=${country}&year=${year}`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch holidays');
  return res.json();
}

export async function upsertHoliday(
  token: string,
  country: string,
  year: number,
  date: string,
  localName: string,
  name: string,
  nameFa: string,
  hidden: boolean,
  isCustom: boolean,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/holidays/${date}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ country, year, localName, name, nameFa, hidden, isCustom }),
  });
  if (!res.ok) throw new Error('Failed to save holiday');
}

export async function deleteHolidayOverride(
  token: string,
  country: string,
  year: number,
  date: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/holidays/${date}?country=${country}&year=${year}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete holiday override');
}

export async function getWeekends(token: string, country: string): Promise<WeekendsResponse> {
  const res = await fetch(apiUrl(`/api/holidays/weekends?country=${country}`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch weekends');
  return res.json();
}

export async function saveWeekends(
  token: string,
  country: string,
  weekendDays: number[],
): Promise<void> {
  const res = await fetch(apiUrl('/api/holidays/weekends'), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ country, weekendDays }),
  });
  if (!res.ok) throw new Error('Failed to save weekends');
}

export async function resetWeekends(token: string, country: string): Promise<WeekendsResponse> {
  const res = await fetch(apiUrl(`/api/holidays/weekends?country=${country}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to reset weekends');
  return res.json();
}
