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

import { apiUrl, authHeaders, createResource } from './base';

type CreateHabitData = { name: string; frequency: string };

const _habits = createResource<Habit, CreateHabitData>('/api/habits');

export const getHabits    = (token: string)                                     => _habits.getAll(token);
export const createHabit  = (token: string, data: CreateHabitData)              => _habits.create(token, data);
export const updateHabit  = (token: string, id: number, data: Partial<Habit>)   => _habits.update(token, id, data);
export const deleteHabit  = (token: string, id: number)                         => _habits.remove(token, id);

export async function logHabit(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/habits/${id}/log`), { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to log habit');
}

export async function unlogHabit(token: string, id: number, date: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/habits/${id}/log/${date}`), { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to unlog habit');
}
