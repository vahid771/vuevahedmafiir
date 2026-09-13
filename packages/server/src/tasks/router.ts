import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();

router.use(authenticateToken);

// GET /api/tasks?status=open|done
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const { status } = req.query;

  let query = 'SELECT * FROM tasks WHERE user_id = ?';
  const params: unknown[] = [userId];

  if (status === 'open' || status === 'done') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

// POST /api/tasks
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const {
    title,
    description,
    due_date,
    priority = 'medium',
    status = 'open',
  } = req.body as {
    title?: string;
    description?: string;
    due_date?: string;
    priority?: string;
    status?: string;
  };

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const result = db
    .prepare(
      'INSERT INTO tasks (user_id, title, description, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(userId, title, description ?? null, due_date ?? null, priority, status);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id
router.patch('/:id', (req, res) => {
  const userId = req.user!.id;
  const taskId = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?')
    .get(taskId, userId);

  if (!existing) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { title, description, due_date, priority, status } = req.body as {
    title?: string;
    description?: string;
    due_date?: string | null;
    priority?: string;
    status?: string;
  };

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date); }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(taskId, userId);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const userId = req.user!.id;
  const taskId = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?')
    .get(taskId, userId);

  if (!existing) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, userId);
  res.status(204).send();
});

export default router;
