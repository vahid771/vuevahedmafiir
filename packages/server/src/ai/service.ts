import { InValue } from '@libsql/client';
import { db } from '../db';
import { nextOccurrence, getWeekBounds, getShamsiWeekBounds, getShamsiDaysSoFar } from '../utils/dates';

export type AiTask = { title: string; due_date: string | null; priority: string };
export type AiBill = { name: string; amount: number | null; due_date: string; recurrence: string };
export type AiSubscription = { name: string; amount: number | null; billing_cycle: string; next_billing_date: string };
export type AiReminder = { title: string; remind_at: string; notes: string | null };
export type AiHabit = { id: number; name: string; name_fa: string | null; name_en: string | null; frequency: string; logsThisWeek: number; daysSoFar: number };
export type AiDate = { title: string; date: string; recurs_yearly: number; notes: string | null; next_occurrence: string };
export type AiLoan = { name: string; lender: string | null; remaining_amount: number; installment: number | null; next_payment_date: string | null };

export type AiContext = {
  today: Date;
  todayStr: string;
  in14: string;
  in30: string;
  weekStartStr: string;
  weekEndStr: string;
  openTasks: AiTask[];
  upcomingBills: AiBill[];
  activeSubscriptions: AiSubscription[];
  pendingReminders: AiReminder[];
  habitsWithLogs: AiHabit[];
  nearDates: AiDate[];
  upcomingLoans: AiLoan[];
};

/**
 * Gathers all user data needed to build the AI summary prompt.
 * @param calendar 'shamsi' uses Saturday–Friday weeks; anything else uses Monday–Sunday.
 * @param todayOverride YYYY-MM-DD from the client's local timezone; falls back to server UTC.
 */
export async function gatherUserData(userId: number, calendar = 'miladi', todayOverride?: string): Promise<AiContext> {
  // Use client-supplied local date to avoid UTC-vs-local-timezone mismatches
  const todayStr = todayOverride && /^\d{4}-\d{2}-\d{2}$/.test(todayOverride)
    ? todayOverride
    : new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr + 'T12:00:00'); // noon to avoid DST edge cases
  const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const isShamsi = calendar === 'shamsi';
  const { start: weekStartStr, end: weekEndStr } = isShamsi ? getShamsiWeekBounds() : getWeekBounds();

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
    sql: 'SELECT id, name, name_fa, name_en, frequency FROM habits WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as { id: number; name: string; name_fa: string | null; name_en: string | null; frequency: string }[];

  // How many days of the current week have elapsed (including today), used for habit completion rate.
  const daysSoFar = isShamsi ? getShamsiDaysSoFar() : (() => {
    const d = today.getDay();
    return d === 0 ? 7 : d; // Mon=1…Sun=7
  })();

  const habitsWithLogs = await Promise.all(habits.map(async h => {
    const args: InValue[] = [h.id, userId, weekStartStr, weekEndStr];
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

  const upcomingLoans = (await db.execute({
    sql: `SELECT name, lender, remaining_amount, installment, next_payment_date
          FROM loans WHERE user_id = ? AND active = 1 AND remaining_amount > 0
          AND (next_payment_date IS NULL OR next_payment_date <= ?)
          ORDER BY next_payment_date ASC`,
    args: [userId, in14],
  })).rows as unknown as AiLoan[];

  return {
    today,
    todayStr,
    in14,
    in30,
    weekStartStr,
    weekEndStr,
    openTasks,
    upcomingBills,
    activeSubscriptions,
    pendingReminders,
    habitsWithLogs,
    nearDates,
    upcomingLoans,
  };
}
