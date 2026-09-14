import { Router } from 'express';
import { InValue } from '@libsql/client';
import type { OAuth2Client } from 'google-auth-library';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';
import {
  getAuthedTasksClient,
  createGoogleTask,
  updateGoogleTask,
  deleteGoogleTask,
} from '../google/tasks.service';

const router = Router();

router.use(authenticateToken);

/** Returns Google Tasks auth + taskListId for the user, or null if not connected. */
async function getGoogleTasksConnection(
  userId: number,
): Promise<{ auth: OAuth2Client; taskListId: string } | null> {
  const row = (
    await db.execute({
      sql: 'SELECT access_token, refresh_token, expiry, task_list_id FROM google_tasks_tokens WHERE user_id = ?',
      args: [userId],
    })
  ).rows[0];

  if (!row || !row.task_list_id) return null;

  const auth = getAuthedTasksClient({
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string | null,
    expiry: row.expiry as string | null,
  });

  return { auth, taskListId: row.task_list_id as string };
}

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

  // Fire-and-forget: push to Google Tasks
  const taskRow = task as any;
  ;(async () => {
    try {
      const conn = await getGoogleTasksConnection(userId);
      if (!conn) return;
      const gtask = await createGoogleTask(conn.auth, conn.taskListId, {
        title: taskRow.title,
        notes: taskRow.description ?? undefined,
        due: taskRow.due_date ?? undefined,
        status: (taskRow.status ?? 'open') as 'open' | 'done',
      });
      await db.execute({
        sql: 'UPDATE tasks SET google_task_id = ? WHERE id = ?',
        args: [gtask.id, taskRow.id],
      });
    } catch { /* silent */ }
  })();
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

  // Fire-and-forget: push to Google Tasks
  const updatedRow = updated as any;
  ;(async () => {
    try {
      const googleTaskId = updatedRow.google_task_id as string | null;
      if (!googleTaskId) return;
      const conn = await getGoogleTasksConnection(userId);
      if (!conn) return;
      await updateGoogleTask(conn.auth, conn.taskListId, googleTaskId, {
        title: updatedRow.title,
        notes: updatedRow.description ?? undefined,
        due: updatedRow.due_date ?? null,
        status: (updatedRow.status ?? 'open') as 'open' | 'done',
      });
    } catch { /* silent */ }
  })();
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const taskId = Number(req.params.id);

  if (!await assertOwnership('tasks', taskId, userId)) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Fetch google_task_id before deleting
  const taskRow = (
    await db.execute({
      sql: 'SELECT google_task_id FROM tasks WHERE id = ?',
      args: [taskId],
    })
  ).rows[0];

  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ? AND user_id = ?', args: [taskId, userId] });
  res.status(204).send();

  // Fire-and-forget: delete from Google Tasks
  ;(async () => {
    try {
      const googleTaskId = taskRow?.google_task_id as string | null;
      if (!googleTaskId) return;
      const conn = await getGoogleTasksConnection(userId);
      if (!conn) return;
      await deleteGoogleTask(conn.auth, conn.taskListId, googleTaskId);
    } catch { /* silent */ }
  })();
});

export default router;
