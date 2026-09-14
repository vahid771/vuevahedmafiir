import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';
import { getWeekBounds } from '../utils/dates';
import { computeStreak } from './service';

const router = Router();
router.use(authenticateToken);

// GET /api/habits
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const habits = (await db.execute({
    sql: 'SELECT * FROM habits WHERE user_id = ? ORDER BY created_at ASC',
    args: [userId],
  })).rows as unknown as {
    id: number;
    user_id: number;
    name: string;
    frequency: string;
    target_days: string;
    created_at: string;
  }[];

  const { monday, sunday } = getWeekBounds();

  const result = await Promise.all(habits.map(async h => {
    const logs = (await db.execute({
      sql: 'SELECT logged_date FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date BETWEEN ? AND ?',
      args: [h.id, userId, monday, sunday],
    })).rows as unknown as { logged_date: string }[];

    return {
      ...h,
      logs_this_week: logs.map(l => l.logged_date),
      current_streak: await computeStreak(Number(h.id), userId),
    };
  }));

  res.json(result);
});

// POST /api/habits
router.post('/', async (req, res) => {
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

  const result = await db.execute({
    sql: 'INSERT INTO habits (user_id, name, frequency, target_days) VALUES (?, ?, ?, ?)',
    args: [userId, name, frequency, target_days],
  });

  const habit = await fetchById<object>('habits', result.lastInsertRowid!);
  res.status(201).json(habit);
});

// PATCH /api/habits/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('habits', id, userId)) { res.status(404).json({ error: 'Habit not found' }); return; }

  const { name, frequency, target_days } = req.body as {
    name?: string;
    frequency?: string;
    target_days?: string;
  };

  const { fields, values } = buildPatch({ name, frequency, target_days });

  if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  values.push(id, userId);
  await db.execute({ sql: `UPDATE habits SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<object>('habits', id);
  res.json(updated);
});

// DELETE /api/habits/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('habits', id, userId)) { res.status(404).json({ error: 'Habit not found' }); return; }

  await db.execute({ sql: 'DELETE FROM habits WHERE id = ? AND user_id = ?', args: [id, userId] });
  res.status(204).send();
});

// POST /api/habits/:id/log
router.post('/:id/log', async (req, res) => {
  const userId = req.user!.id;
  const habitId = Number(req.params.id);

  if (!await assertOwnership('habits', habitId, userId)) { res.status(404).json({ error: 'Habit not found' }); return; }

  const today = new Date().toISOString().slice(0, 10);

  // Idempotent insert
  await db.execute({
    sql: 'INSERT OR IGNORE INTO habit_logs (habit_id, user_id, logged_date) VALUES (?, ?, ?)',
    args: [habitId, userId, today],
  });

  res.status(201).json({ logged_date: today });
});

// DELETE /api/habits/:id/log/:date
router.delete('/:id/log/:date', async (req, res) => {
  const userId = req.user!.id;
  const habitId = Number(req.params.id);
  const date = req.params.date;

  const result = await db.execute({
    sql: 'DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date = ?',
    args: [habitId, userId, date],
  });

  if (result.rowsAffected === 0) {
    res.status(404).json({ error: 'Log not found' });
    return;
  }

  res.status(204).send();
});

export default router;
