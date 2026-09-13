import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

// GET /api/reminders
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const reminders = db
    .prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC')
    .all(userId);
  res.json(reminders);
});

// POST /api/reminders
router.post('/', (req, res) => {
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

  const result = db
    .prepare('INSERT INTO reminders (user_id, title, remind_at, notes) VALUES (?, ?, ?, ?)')
    .run(userId, title, remind_at, notes ?? null);

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(reminder);
});

// PATCH /api/reminders/:id
router.patch('/:id', (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM reminders WHERE id = ? AND user_id = ?')
    .get(id, userId);

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
  const values: unknown[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (remind_at !== undefined) { fields.push('remind_at = ?'); values.push(remind_at); }
  if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
  if (done !== undefined) { fields.push('done = ?'); values.push(done); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id, userId);
  db.prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/reminders/:id
router.delete('/:id', (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM reminders WHERE id = ? AND user_id = ?')
    .get(id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(id, userId);
  res.status(204).send();
});

export default router;
