import { Router } from 'express';
import { InValue } from '@libsql/client';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';

const router = Router();

router.use(authenticateToken);

// GET /api/tasks?status=open|done
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const { status } = req.query;

  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const args: InValue[] = [userId];

  if (status === 'open' || status === 'done') {
    sql += ' AND status = ?';
    args.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  const tasks = (await db.execute({ sql, args })).rows;
  res.json(tasks);
});

// POST /api/tasks
router.post('/', async (req, res) => {
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

  const result = await db.execute({
    sql: 'INSERT INTO tasks (user_id, title, description, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, title, description ?? null, due_date ?? null, priority, status],
  });

  const task = await fetchById<object>('tasks', result.lastInsertRowid!);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const taskId = Number(req.params.id);

  if (!await assertOwnership('tasks', taskId, userId)) {
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

  const { fields, values } = buildPatch({
    title,
    description: description !== undefined ? (description ?? null) : undefined,
    due_date: due_date !== undefined ? (due_date ?? null) : undefined,
    priority,
    status,
  });

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(taskId, userId);
  await db.execute({ sql: `UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<object>('tasks', taskId);
  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const taskId = Number(req.params.id);

  if (!await assertOwnership('tasks', taskId, userId)) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ? AND user_id = ?', args: [taskId, userId] });
  res.status(204).send();
});

export default router;
