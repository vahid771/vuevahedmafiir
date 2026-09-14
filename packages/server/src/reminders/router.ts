import { Router } from 'express';
import { InValue } from '@libsql/client';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

// GET /api/reminders
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const reminders = (await db.execute({
    sql: 'SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC',
    args: [userId],
  })).rows;
  res.json(reminders);
});

// POST /api/reminders
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { title, remind_at, notes } = req.body as {
    title?: string;
    remind_at?: string;
    notes?: string;
  };

  if (!title || !remind_at) {
    res.status(400).json({ error: 'title and remind_at are required' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO reminders (user_id, title, remind_at, notes) VALUES (?, ?, ?, ?)',
    args: [userId, title, remind_at, notes ?? null],
  });

  const reminder = (await db.execute({ sql: 'SELECT * FROM reminders WHERE id = ?', args: [result.lastInsertRowid!] })).rows[0];
  res.status(201).json(reminder);
});

// PATCH /api/reminders/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const existing = (await db.execute({ sql: 'SELECT id FROM reminders WHERE id = ? AND user_id = ?', args: [id, userId] })).rows[0];
  if (!existing) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  const { title, remind_at, notes, done } = req.body as {
    title?: string;
    remind_at?: string;
    notes?: string | null;
    done?: number;
  };

  const fields: string[] = [];
  const values: InValue[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (remind_at !== undefined) { fields.push('remind_at = ?'); values.push(remind_at); }
  if (notes !== undefined) { fields.push('notes = ?'); values.push(notes ?? null); }
  if (done !== undefined) { fields.push('done = ?'); values.push(done); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id, userId);
  await db.execute({ sql: `UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = (await db.execute({ sql: 'SELECT * FROM reminders WHERE id = ?', args: [id] })).rows[0];
  res.json(updated);
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const existing = (await db.execute({ sql: 'SELECT id FROM reminders WHERE id = ? AND user_id = ?', args: [id, userId] })).rows[0];
  if (!existing) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  await db.execute({ sql: 'DELETE FROM reminders WHERE id = ? AND user_id = ?', args: [id, userId] });
  res.status(204).send();
});

export default router;
