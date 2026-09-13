import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

function getWeekBounds(): { monday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { monday: fmt(monday), sunday: fmt(sunday) };
}

function computeStreak(habitId: number, userId: number): number {
  const logs = db
    .prepare('SELECT logged_date FROM habit_logs WHERE habit_id = ? AND user_id = ? ORDER BY logged_date DESC')
    .all(habitId, userId) as { logged_date: string }[];

  if (logs.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

  // streak starts only if today or yesterday was logged
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

// GET /api/habits
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY created_at ASC').all(userId) as {
    id: number;
    user_id: number;
    name: string;
    frequency: string;
    target_days: string;
    created_at: string;
  }[];

  const { monday, sunday } = getWeekBounds();

  const result = habits.map(h => {
    const logs = db
      .prepare('SELECT logged_date FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date BETWEEN ? AND ?')
      .all(h.id, userId, monday, sunday) as { logged_date: string }[];

    return {
      ...h,
      logs_this_week: logs.map(l => l.logged_date),
      current_streak: computeStreak(h.id, userId),
    };
  });

  res.json(result);
});

// POST /api/habits
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const { name, frequency = 'daily', target_days = '[]' } = req.body as {
    name?: string;
    frequency?: string;
    target_days?: string;
  };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = db
    .prepare('INSERT INTO habits (user_id, name, frequency, target_days) VALUES (?, ?, ?, ?)')
    .run(userId, name, frequency, target_days);

  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(habit);
});

// PATCH /api/habits/:id
router.patch('/:id', (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const existing = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) { res.status(404).json({ error: 'Habit not found' }); return; }

  const { name, frequency, target_days } = req.body as {
    name?: string;
    frequency?: string;
    target_days?: string;
  };

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (frequency !== undefined) { fields.push('frequency = ?'); values.push(frequency); }
  if (target_days !== undefined) { fields.push('target_days = ?'); values.push(target_days); }

  if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  values.push(id, userId);
  db.prepare(`UPDATE habits SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/habits/:id
router.delete('/:id', (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const existing = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) { res.status(404).json({ error: 'Habit not found' }); return; }

  db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(id, userId);
  res.status(204).send();
});

// POST /api/habits/:id/log
router.post('/:id/log', (req, res) => {
  const userId = req.user!.id;
  const habitId = Number(req.params.id);

  const existing = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, userId);
  if (!existing) { res.status(404).json({ error: 'Habit not found' }); return; }

  const today = new Date().toISOString().slice(0, 10);

  // Idempotent insert
  db.prepare(
    'INSERT OR IGNORE INTO habit_logs (habit_id, user_id, logged_date) VALUES (?, ?, ?)'
  ).run(habitId, userId, today);

  res.status(201).json({ logged_date: today });
});

// DELETE /api/habits/:id/log/:date
router.delete('/:id/log/:date', (req, res) => {
  const userId = req.user!.id;
  const habitId = Number(req.params.id);
  const date = req.params.date;

  const result = db
    .prepare('DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date = ?')
    .run(habitId, userId, date);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Log not found' });
    return;
  }

  res.status(204).send();
});

export default router;
