import { apiUrl, authHeaders } from './base';

const BASE = '/api/google-calendar';

export interface GoogleCalendarStatus {
  connected: boolean;
}

export interface GoogleCalendarSyncResult {
  reminders: any[];
  dates: any[];
  tasks: any[];
}

/** Returns the URL to navigate the browser to for the Google Calendar OAuth connect flow. */
export function getGoogleCalendarConnectUrl(token: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${BASE}/connect?token=${encodeURIComponent(token)}`;
}

export async function getGoogleCalendarStatus(token: string): Promise<GoogleCalendarStatus> {
  const res = await fetch(apiUrl(`${BASE}/status`), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch Google Calendar status');
  return res.json();
}

export async function disconnectGoogleCalendar(token: string): Promise<void> {
  const res = await fetch(apiUrl(`${BASE}/disconnect`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to disconnect Google Calendar');
}

export async function syncFromGoogleCalendar(token: string): Promise<GoogleCalendarSyncResult> {
  const res = await fetch(apiUrl(`${BASE}/sync`), {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to sync from Google Calendar');
  return res.json() as Promise<GoogleCalendarSyncResult>;
}
