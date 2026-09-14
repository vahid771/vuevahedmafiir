export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  remind_at: string;
  notes: string | null;
  done: number;
  created_at: string;
}

import { apiUrl, authHeaders } from './base';

export async function getReminders(token: string): Promise<Reminder[]> {
  const res = await fetch(apiUrl('/api/reminders'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch reminders');
  return res.json();
}

export async function createReminder(token: string, data: Partial<Reminder>): Promise<Reminder> {
  const res = await fetch(apiUrl('/api/reminders'), { method: 'POST', headers: authHeaders(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create reminder');
  return res.json();
}

export async function updateReminder(token: string, id: number, data: Partial<Reminder>): Promise<Reminder> {
  const res = await fetch(apiUrl(`/api/reminders/${id}`), { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update reminder');
  return res.json();
}

export async function deleteReminder(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/reminders/${id}`), { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to delete reminder');
}
