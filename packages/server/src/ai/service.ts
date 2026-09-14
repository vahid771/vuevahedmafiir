import { InValue } from '@libsql/client';
import { db } from '../db';
import { nextOccurrence, getWeekBounds } from '../utils/dates';

export type AiTask = { title: string; due_date: string | null; priority: string };
export type AiBill = { name: string; amount: number | null; due_date: string; recurrence: string };
export type AiSubscription = { name: string; amount: number | null; billing_cycle: string; next_billing_date: string };
export type AiReminder = { title: string; remind_at: string; notes: string | null };
export type AiHabit = { id: number; name: string; frequency: string; logsThisWeek: number; daysSoFar: number };
export type AiDate = { title: string; date: string; recurs_yearly: number; notes: string | null; next_occurrence: string };

export type AiContext = {
  today: Date;
  todayStr: string;
  in14: string;
  in30: string;
  mondayStr: string;
  sundayStr: string;
  openTasks: AiTask[];
  upcomingBills: AiBill[];
  activeSubscriptions: AiSubscription[];
  pendingReminders: AiReminder[];
  habitsWithLogs: AiHabit[];
  nearDates: AiDate[];
};

/**
 * Gathers all user data needed to build the AI summary prompt.
 */
export async function gatherUserData(userId: number): Promise<AiContext> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const { monday, sunday } = getWeekBounds();
  const mondayStr = monday;
  const sundayStr = sunday;

  const openTasks = (await db.execute({
    sql: "SELECT title, due_date, priority FROM tasks WHERE user_id = ? AND status = 'open' ORDER BY due_date ASC, priority DESC LIMIT 20",
    args: [userId],
  })).rows as unknown as AiTask[];

  const upcomingBills = (await db.execute({
    sql: 'SELECT name, amount, due_date, recurrence FROM bills WHERE user_id = ? AND paid = 0 AND due_date <= ? ORDER BY due_date ASC',
    args: [userId, in14],
  })).rows as unknown as AiBill[];

  const activeSubscriptions = (await db.execute({
    sql: 'SELECT name, amount, billing_cycle, next_billing_date FROM subscriptions WHERE user_id = ? AND active = 1 AND next_billing_date <= ? ORDER BY next_billing_date ASC',
    args: [userId, in14],
  })).rows as unknown as AiSubscription[];

  const pendingReminders = (await db.execute({
    sql: 'SELECT title, remind_at, notes FROM reminders WHERE user_id = ? AND done = 0 AND remind_at <= ? ORDER BY remind_at ASC',
    args: [userId, new Date(today.getTime() + 7 * 86400000).toISOString()],
  })).rows as unknown as AiReminder[];

  const habits = (await db.execute({
    sql: 'SELECT id, name, frequency FROM habits WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as { id: number; name: string; frequency: string }[];

  const day = today.getDay();
  const daysSoFar = Math.min(day === 0 ? 7 : day, 7);

  const habitsWithLogs = await Promise.all(habits.map(async h => {
    const args: InValue[] = [h.id, userId, mondayStr, sundayStr];
    const logs = (await db.execute({
      sql: 'SELECT logged_date FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date BETWEEN ? AND ?',
      args,
    })).rows;
    return { ...h, logsThisWeek: logs.length, daysSoFar };
  }));

  const rawDates = (await db.execute({
    sql: 'SELECT title, date, recurs_yearly, notes FROM important_dates WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as { title: string; date: string; recurs_yearly: number; notes: string | null }[];

  const nearDates = rawDates
    .map(d => ({ ...d, next_occurrence: nextOccurrence(d.date, d.recurs_yearly) }))
    .filter(d => d.next_occurrence >= todayStr && d.next_occurrence <= in30)
    .sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence));

  return {
    today,
    todayStr,
    in14,
    in30,
    mondayStr,
    sundayStr,
    openTasks,
    upcomingBills,
    activeSubscriptions,
    pendingReminders,
    habitsWithLogs,
    nearDates,
  };
}
