export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  remind_at: string;
  notes: string | null;
  done: number;
  created_at: string;
}

import { apiUrl } from './base';

const h = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

export async function getReminders(token: string): Promise<Reminder[]> {
  const res = await fetch(apiUrl('/api/reminders'), { headers: h(token) });
  if (!res.ok) throw new Error('Failed to fetch reminders');
  return res.json();
}

export async function createReminder(token: string, data: Partial<Reminder>): Promise<Reminder> {
  const res = await fetch(apiUrl('/api/reminders'), { method: 'POST', headers: h(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create reminder');
  return res.json();
}

export async function updateReminder(token: string, id: number, data: Partial<Reminder>): Promise<Reminder> {
  const res = await fetch(apiUrl(`/api/reminders/${id}`), { method: 'PATCH', headers: h(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update reminder');
  return res.json();
}

export async function deleteReminder(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/reminders/${id}`), { method: 'DELETE', headers: h(token) });
  if (!res.ok) throw new Error('Failed to delete reminder');
}
