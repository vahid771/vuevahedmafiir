export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  remind_at: string;
  notes: string | null;
  done: number;
  created_at: string;
}

import { createResource } from './base';

const _reminders = createResource<Reminder>('/api/reminders');

export const getReminders    = (token: string)                                         => _reminders.getAll(token);
export const createReminder  = (token: string, data: Partial<Reminder>)                => _reminders.create(token, data);
export const updateReminder  = (token: string, id: number, data: Partial<Reminder>)    => _reminders.update(token, id, data);
export const deleteReminder  = (token: string, id: number)                             => _reminders.remove(token, id);
