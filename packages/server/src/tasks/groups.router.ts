import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import {
  getAuthedTasksClient,
  listTaskLists,
  listGoogleTasks,
  createGoogleTaskList,
  updateGoogleTaskList,
} from '../google/tasks.service';

async function getGoogleTasksAuth(userId: number) {
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry FROM google_tasks_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];
  if (!row) return null;
  return getAuthedTasksClient({
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string | null,
    expiry: row.expiry as string | null,
  });
}

const router = Router();
router.use(authenticateToken);

// GET /api/task-groups
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const groups = (await db.execute({
    sql: 'SELECT * FROM task_groups WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [userId],
  })).rows;
  res.json(groups);
});

// POST /api/task-groups
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }

  let googleListId: string | null = null;
  try {
    const auth = await getGoogleTasksAuth(userId);
    if (auth) {
      const gl = await createGoogleTaskList(auth, name.trim());
      googleListId = gl.id;
    }
  } catch { /* non-fatal */ }

  const result = await db.execute({
    sql: 'INSERT INTO task_groups (user_id, name, google_list_id) VALUES (?, ?, ?)',
    args: [userId, name.trim(), googleListId],
  });
  const group = (await db.execute({
    sql: 'SELECT * FROM task_groups WHERE id = ?',
    args: [result.lastInsertRowid!],
  })).rows[0];
  res.status(201).json(group);
});

// PATCH /api/task-groups/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const existing = (await db.execute({
    sql: 'SELECT id, google_list_id FROM task_groups WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0] as { id: number; google_list_id: string | null } | undefined;
  if (!existing) { res.status(404).json({ error: 'Group not found' }); return; }

  await db.execute({
    sql: 'UPDATE task_groups SET name = ? WHERE id = ? AND user_id = ?',
    args: [name.trim(), id, userId],
  });

  // Push rename to Google Tasks if linked
  try {
    if (existing.google_list_id) {
      const auth = await getGoogleTasksAuth(userId);
      if (auth) await updateGoogleTaskList(auth, existing.google_list_id, name.trim());
    }
  } catch { /* non-fatal */ }

  const group = (await db.execute({
    sql: 'SELECT * FROM task_groups WHERE id = ?',
    args: [id],
  })).rows[0];
  res.json(group);
});

// DELETE /api/task-groups/:id — nullifies tasks' group, then deletes the group
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const existing = (await db.execute({
    sql: 'SELECT id FROM task_groups WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0];
  if (!existing) { res.status(404).json({ error: 'Group not found' }); return; }
  await db.execute({ sql: 'UPDATE tasks SET task_group_id = NULL WHERE task_group_id = ? AND user_id = ?', args: [id, userId] });
  await db.execute({ sql: 'DELETE FROM task_groups WHERE id = ? AND user_id = ?', args: [id, userId] });
  res.status(204).send();
});

// POST /api/task-groups/sync-google
// Fetches all Google Task lists and upserts each as a group, then syncs tasks per list.
router.post('/sync-google', async (req, res) => {
  const userId = req.user!.id;

  const tokenRow = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry FROM google_tasks_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];

  if (!tokenRow) {
    res.status(400).json({ error: 'Google Tasks not connected' });
    return;
  }

  const auth = getAuthedTasksClient({
    access_token: tokenRow.access_token as string,
    refresh_token: tokenRow.refresh_token as string | null,
    expiry: tokenRow.expiry as string | null,
  });

  const googleLists = await listTaskLists(auth);

  for (const gl of googleLists) {
    // Upsert group by google_list_id
    const existing = (await db.execute({
      sql: 'SELECT id FROM task_groups WHERE user_id = ? AND google_list_id = ?',
      args: [userId, gl.id],
    })).rows[0];

    let groupId: number;
    if (existing) {
      await db.execute({
        sql: 'UPDATE task_groups SET name = ? WHERE id = ?',
        args: [gl.title, existing.id],
      });
      groupId = existing.id as number;
    } else {
      const ins = await db.execute({
        sql: 'INSERT INTO task_groups (user_id, name, google_list_id) VALUES (?, ?, ?)',
        args: [userId, gl.title, gl.id],
      });
      groupId = Number(ins.lastInsertRowid!);
    }

    // Sync tasks for this list into this group
    const googleTasks = await listGoogleTasks(auth, gl.id);
    for (const gt of googleTasks) {
      const localStatus = gt.status === 'completed' ? 'done' : 'open';
      const dueDate = gt.due ? gt.due.substring(0, 10) : null;
      const existingTask = (await db.execute({
        sql: 'SELECT id FROM tasks WHERE google_task_id = ? AND user_id = ?',
        args: [gt.id, userId],
      })).rows[0];

      if (existingTask) {
        await db.execute({
          sql: 'UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ?, task_group_id = ? WHERE id = ? AND user_id = ?',
          args: [gt.title, gt.notes ?? null, dueDate, localStatus, groupId, existingTask.id, userId],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO tasks (user_id, title, description, due_date, priority, status, google_task_id, task_group_id)
                VALUES (?, ?, ?, ?, 'medium', ?, ?, ?)`,
          args: [userId, gt.title, gt.notes ?? null, dueDate, localStatus, gt.id, groupId],
        });
      }
    }
  }

  // Return updated groups
  const groups = (await db.execute({
    sql: 'SELECT * FROM task_groups WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [userId],
  })).rows;

  res.json(groups);
});

export default router;
