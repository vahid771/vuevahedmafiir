import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { buildPatch, fetchById, assertOwnership } from '../utils/db';

const router = Router();
router.use(authenticateToken);

// GET /api/task-columns?group_id=N
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const groupId = Number(req.query.group_id);
  if (!groupId) { res.status(400).json({ error: 'group_id is required' }); return; }

  const columns = (await db.execute({
    sql: 'SELECT * FROM task_columns WHERE task_group_id = ? AND user_id = ? ORDER BY sort_order ASC',
    args: [groupId, userId],
  })).rows;
  res.json(columns);
});

// POST /api/task-columns
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { task_group_id, name, color, sort_order } = req.body as {
    task_group_id?: number;
    name?: string;
    color?: string;
    sort_order?: number;
  };

  if (!task_group_id || !name?.trim()) {
    res.status(400).json({ error: 'task_group_id and name are required' });
    return;
  }

  // Assert the group belongs to this user
  const groupOwned = await assertOwnership('task_groups', task_group_id, userId);
  if (!groupOwned) { res.status(404).json({ error: 'Group not found' }); return; }

  const result = await db.execute({
    sql: 'INSERT INTO task_columns (user_id, task_group_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)',
    args: [userId, task_group_id, name.trim(), color ?? '#6366f1', sort_order ?? 0],
  });

  const column = await fetchById<object>('task_columns', result.lastInsertRowid!);
  res.status(201).json(column);
});

// PATCH /api/task-columns/reorder — must be before /:id
router.patch('/reorder', async (req, res) => {
  const userId = req.user!.id;
  const { columns } = req.body as { columns?: { id: number; sort_order: number }[] };

  if (!Array.isArray(columns) || columns.length === 0) {
    res.status(400).json({ error: 'columns array is required' });
    return;
  }

  await db.batch(
    columns.map(({ id, sort_order }) => ({
      sql: 'UPDATE task_columns SET sort_order = ? WHERE id = ? AND user_id = ?',
      args: [sort_order, id, userId],
    })),
  );

  res.status(204).send();
});

// PATCH /api/task-columns/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const { name, color, sort_order } = req.body as { name?: string; color?: string; sort_order?: number };

  const { fields, values } = buildPatch({ name, color, sort_order });
  if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  const owned = await assertOwnership('task_columns', id, userId);
  if (!owned) { res.status(404).json({ error: 'Column not found' }); return; }

  values.push(id, userId);
  await db.execute({
    sql: `UPDATE task_columns SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    args: values,
  });

  const column = await fetchById<object>('task_columns', id);
  res.json(column);
});

// DELETE /api/task-columns/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const owned = await assertOwnership('task_columns', id, userId);
  if (!owned) { res.status(404).json({ error: 'Column not found' }); return; }

  await db.execute({
    sql: 'DELETE FROM task_columns WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  res.status(204).send();
});

export default router;
