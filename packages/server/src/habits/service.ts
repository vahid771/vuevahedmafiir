import { db } from '../db';

/**
 * Computes the current consecutive-day streak for a single habit.
 * A streak only counts if today or yesterday was logged.
 */
export async function computeStreak(habitId: number, userId: number): Promise<number> {
  const logs = (await db.execute({
    sql: 'SELECT logged_date FROM habit_logs WHERE habit_id = ? AND user_id = ? ORDER BY logged_date DESC',
    args: [habitId, userId],
  })).rows as unknown as { logged_date: string }[];

  if (logs.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

  // Streak starts only if today or yesterday was logged
  const firstLog = logs[0].logged_date;
  if (firstLog !== todayStr && firstLog !== yesterdayStr) return 0;

  let streak = 0;
  let expected = new Date(firstLog);
  expected.setHours(0, 0, 0, 0);

  for (const { logged_date } of logs) {
    const logDate = new Date(logged_date);
    logDate.setHours(0, 0, 0, 0);
    if (logDate.getTime() === expected.getTime()) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
