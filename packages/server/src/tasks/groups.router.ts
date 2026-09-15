import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import {
  getAuthedTasksClient,
  listTaskLists,
  listGoogleTasks,
  createGoogleTaskList,
  createGoogleTask,
  updateGoogleTaskList,
  deleteGoogleTaskList,
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

  // First group for this user becomes the default
  const existingCount = (await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM task_groups WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as { cnt: number };
  const isDefault = existingCount.cnt === 0 ? 1 : 0;

  let googleListId: string | null = null;
  let isGoogleDefault = 0;
  try {
    const auth = await getGoogleTasksAuth(userId);
    if (auth) {
      if (isDefault) {
        // Link the local default group to Google's default list (first in the list)
        // instead of creating a brand-new list.
        const googleLists = await listTaskLists(auth);
        if (googleLists.length > 0) {
          googleListId = googleLists[0].id;
          isGoogleDefault = 1;
        }
      } else {
        const gl = await createGoogleTaskList(auth, name.trim());
        googleListId = gl.id;
      }
    }
  } catch { /* non-fatal */ }

  const result = await db.execute({
    sql: 'INSERT INTO task_groups (user_id, name, google_list_id, is_default, is_google_default) VALUES (?, ?, ?, ?, ?)',
    args: [userId, name.trim(), googleListId, isDefault, isGoogleDefault],
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
  })).rows[0] as unknown as { id: number; google_list_id: string | null } | undefined;
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

// PATCH /api/task-groups/:id/set-default — makes this group the default (clears previous default)
router.patch('/:id/set-default', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const existing = (await db.execute({
    sql: 'SELECT id, google_list_id FROM task_groups WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0] as unknown as { id: number; google_list_id: string | null } | undefined;
  if (!existing) { res.status(404).json({ error: 'Group not found' }); return; }

  // Clear current default, then set new one
  await db.execute({ sql: 'UPDATE task_groups SET is_default = 0 WHERE user_id = ?', args: [userId] });
  await db.execute({ sql: 'UPDATE task_groups SET is_default = 1 WHERE id = ? AND user_id = ?', args: [id, userId] });

  // Move any still-ungrouped tasks into the new default group
  await db.execute({
    sql: 'UPDATE tasks SET task_group_id = ? WHERE user_id = ? AND task_group_id IS NULL',
    args: [id, userId],
  });

  // Update the legacy Google Tasks token to point at the new default group's linked list,
  // so new tasks without an explicit group sync to the correct Google list.
  if (existing.google_list_id) {
    try {
      await db.execute({
        sql: 'UPDATE google_tasks_tokens SET task_list_id = ? WHERE user_id = ?',
        args: [existing.google_list_id, userId],
      });
    } catch { /* non-fatal */ }
  }

  const groups = (await db.execute({
    sql: 'SELECT * FROM task_groups WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [userId],
  })).rows;
  res.json(groups);
});

// DELETE /api/task-groups/:id — moves tasks to default group, then deletes the group
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const existing = (await db.execute({
    sql: 'SELECT id, google_list_id, is_default, is_google_default FROM task_groups WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0] as unknown as { id: number; google_list_id: string | null; is_default: number; is_google_default: number } | undefined;
  if (!existing) { res.status(404).json({ error: 'Group not found' }); return; }
  if (existing.is_default) { res.status(403).json({ error: 'Cannot delete the default group' }); return; }
  if (existing.is_google_default) { res.status(403).json({ error: 'Cannot delete the Google Tasks default list group' }); return; }

  // Move tasks to the default group (or NULL if none exists)
  const defaultGroup = (await db.execute({
    sql: 'SELECT id FROM task_groups WHERE user_id = ? AND is_default = 1 LIMIT 1',
    args: [userId],
  })).rows[0];
  const fallbackId = defaultGroup ? defaultGroup.id : null;
  await db.execute({ sql: 'UPDATE tasks SET task_group_id = ? WHERE task_group_id = ? AND user_id = ?', args: [fallbackId, id, userId] });
  await db.execute({ sql: 'DELETE FROM task_groups WHERE id = ? AND user_id = ?', args: [id, userId] });
  // Delete the Google Task list if linked
  try {
    if (existing.google_list_id) {
      const auth = await getGoogleTasksAuth(userId);
      if (auth) await deleteGoogleTaskList(auth, existing.google_list_id);
    }
  } catch { /* non-fatal */ }
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

  // The first list returned by Google is always their default "My Tasks" list.
  const googleDefaultListId = googleLists.length > 0 ? googleLists[0].id : null;

  // Fetch our local default group once so we can link it if needed.
  const localDefaultGroup = (await db.execute({
    sql: 'SELECT id, google_list_id FROM task_groups WHERE user_id = ? AND is_default = 1',
    args: [userId],
  })).rows[0] as unknown as { id: number; google_list_id: string | null } | undefined;

  // If the local default group has no google_list_id yet, link it to Google's default list.
  if (localDefaultGroup && !localDefaultGroup.google_list_id && googleDefaultListId) {
    await db.execute({
      sql: 'UPDATE task_groups SET google_list_id = ? WHERE id = ?',
      args: [googleDefaultListId, localDefaultGroup.id],
    });
    localDefaultGroup.google_list_id = googleDefaultListId;
  }

  // Reset is_google_default on all groups before re-marking
  await db.execute({ sql: 'UPDATE task_groups SET is_google_default = 0 WHERE user_id = ?', args: [userId] });

  for (const [idx, gl] of googleLists.entries()) {
    const isGoogleDefault = idx === 0 ? 1 : 0;

    // Upsert group by google_list_id — also match the local default group by Google's default list id.
    const existing = (await db.execute({
      sql: 'SELECT id FROM task_groups WHERE user_id = ? AND google_list_id = ?',
      args: [userId, gl.id],
    })).rows[0];

    let groupId: number;
    if (existing) {
      await db.execute({
        sql: 'UPDATE task_groups SET name = ?, is_google_default = ? WHERE id = ?',
        args: [gl.title, isGoogleDefault, existing.id],
      });
      groupId = existing.id as number;
    } else {
      // No local group linked to this Google list — create one (non-default)
      const ins = await db.execute({
        sql: 'INSERT INTO task_groups (user_id, name, google_list_id, is_google_default) VALUES (?, ?, ?, ?)',
        args: [userId, gl.title, gl.id, isGoogleDefault],
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

  // --- Local → Google: push local groups and tasks with no Google counterpart ---

  // Re-fetch groups (may have new google_list_ids from above)
  const localGroups = (await db.execute({
    sql: 'SELECT id, name, google_list_id FROM task_groups WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as { id: number; name: string; google_list_id: string | null }[];

  for (const group of localGroups) {
    if (group.google_list_id) continue;
    try {
      const gl = await createGoogleTaskList(auth, group.name);
      await db.execute({
        sql: 'UPDATE task_groups SET google_list_id = ? WHERE id = ?',
        args: [gl.id, group.id],
      });
      group.google_list_id = gl.id;
    } catch { /* non-fatal */ }
  }

  // Build a group-id → google_list_id map. Normalise keys to Number() because
  // libSQL can return BigInt for integer columns, which would cause Map misses.
  const groupListMap = new Map<number, string>();
  for (const g of localGroups) {
    if (g.google_list_id) groupListMap.set(Number(g.id), g.google_list_id);
  }

  // Push local tasks with no google_task_id
  const localUnsynced = (await db.execute({
    sql: `SELECT id, title, description, due_date, status, task_group_id
          FROM tasks
          WHERE user_id = ? AND google_task_id IS NULL`,
    args: [userId],
  })).rows as unknown as {
    id: number; title: string; description: string | null;
    due_date: string | null; status: string; task_group_id: number | null;
  }[];

  const fallbackListId = googleDefaultListId;
  for (const task of localUnsynced) {
    const targetListId = (task.task_group_id != null ? groupListMap.get(Number(task.task_group_id)) : null) ?? fallbackListId;
    if (!targetListId) continue;
    try {
      const gt = await createGoogleTask(auth, targetListId, {
        title: task.title,
        notes: task.description ?? undefined,
        due: task.due_date ? `${task.due_date}T00:00:00.000Z` : undefined,
        status: task.status as 'open' | 'done',
      });
      await db.execute({
        sql: 'UPDATE tasks SET google_task_id = ? WHERE id = ?',
        args: [gt.id, task.id],
      });
    } catch { /* non-fatal */ }
  }

  // Return updated groups
  const groups = (await db.execute({
    sql: 'SELECT * FROM task_groups WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [userId],
  })).rows;

  res.json(groups);
});

export default router;
