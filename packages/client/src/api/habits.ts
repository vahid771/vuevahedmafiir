export interface Habit {
  id: number;
  user_id: number;
  name: string;
  name_en: string | null;
  name_fa: string | null;
  frequency: 'daily' | 'weekly';
  target_days: string;
  created_at: string;
  logs_this_week: string[];
  current_streak: number;
}

import { apiUrl, authHeaders } from './base';

export async function getHabits(token: string): Promise<Habit[]> {
  const res = await fetch(apiUrl('/api/habits'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch habits');
  return res.json();
}

export async function createHabit(token: string, data: { name: string; frequency: string }): Promise<Habit> {
  const res = await fetch(apiUrl('/api/habits'), { method: 'POST', headers: authHeaders(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create habit');
  return res.json();
}

export async function updateHabit(token: string, id: number, data: Partial<Habit>): Promise<Habit> {
  const res = await fetch(apiUrl(`/api/habits/${id}`), { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update habit');
  return res.json();
}

export async function deleteHabit(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/habits/${id}`), { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to delete habit');
}

export async function logHabit(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/habits/${id}/log`), { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to log habit');
}

export async function unlogHabit(token: string, id: number, date: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/habits/${id}/log/${date}`), { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to unlog habit');
}
