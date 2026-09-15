import { Router } from 'express';
import type { OAuth2Client } from 'google-auth-library';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import {
  getTasksAuthUrl,
  exchangeTasksCode,
  getAuthedTasksClient,
  listTaskLists,
  listGoogleTasks,
  createGoogleTaskList,
  createGoogleTask,
} from './tasks.service';

/**
 * Full bidirectional sync between Google Tasks and local DB for a given user.
 * - Google → Local: all lists become groups, all tasks are upserted into those groups.
 * - Local → Google: groups without a google_list_id get a new Google list;
 *                   tasks without a google_task_id get pushed to their group's list.
 */
async function performFullSync(userId: number, auth: OAuth2Client): Promise<void> {
  const googleLists = await listTaskLists(auth);
  const googleDefaultListId = googleLists.length > 0 ? googleLists[0].id : null;

  // --- Link local default group to Google's default list if not yet linked ---
  const localDefaultGroup = (await db.execute({
    sql: 'SELECT id, google_list_id FROM task_groups WHERE user_id = ? AND is_default = 1',
    args: [userId],
  })).rows[0] as unknown as { id: number; google_list_id: string | null } | undefined;

  if (localDefaultGroup && !localDefaultGroup.google_list_id && googleDefaultListId) {
    await db.execute({
      sql: 'UPDATE task_groups SET google_list_id = ?, is_google_default = 1 WHERE id = ?',
      args: [googleDefaultListId, localDefaultGroup.id],
    });
    localDefaultGroup.google_list_id = googleDefaultListId;
  }

  // --- Reset is_google_default, then re-mark ---
  await db.execute({ sql: 'UPDATE task_groups SET is_google_default = 0 WHERE user_id = ?', args: [userId] });

  // --- Google → Local: upsert all lists as groups, upsert all tasks ---
  for (const [idx, gl] of googleLists.entries()) {
    const isGoogleDefault = idx === 0 ? 1 : 0;

    const existingGroup = (await db.execute({
      sql: 'SELECT id FROM task_groups WHERE user_id = ? AND google_list_id = ?',
      args: [userId, gl.id],
    })).rows[0];

    let groupId: number;
    if (existingGroup) {
      await db.execute({
        sql: 'UPDATE task_groups SET name = ?, is_google_default = ? WHERE id = ?',
        args: [gl.title, isGoogleDefault, existingGroup.id],
      });
      groupId = existingGroup.id as number;
    } else {
      const ins = await db.execute({
        sql: 'INSERT INTO task_groups (user_id, name, google_list_id, is_google_default) VALUES (?, ?, ?, ?)',
        args: [userId, gl.title, gl.id, isGoogleDefault],
      });
      groupId = Number(ins.lastInsertRowid!);
    }

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

  // --- Local → Google: push local groups and tasks that have no Google counterpart ---

  // Push local groups that have no google_list_id yet
  const localGroups = (await db.execute({
    sql: 'SELECT id, name, google_list_id FROM task_groups WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as { id: number; name: string; google_list_id: string | null }[];

  for (const group of localGroups) {
    if (group.google_list_id) continue; // already linked
    try {
      const gl = await createGoogleTaskList(auth, group.name);
      await db.execute({
        sql: 'UPDATE task_groups SET google_list_id = ? WHERE id = ?',
        args: [gl.id, group.id],
      });
      group.google_list_id = gl.id;
    } catch { /* non-fatal */ }
  }

  // Build a group-id → google_list_id map from the already-updated localGroups array.
  // Use Number() keys — libSQL can return BigInt for integer columns and Map lookups
  // are identity-typed, so we normalise everything to number.
  const groupListMap = new Map<number, string>();
  for (const g of localGroups) {
    if (g.google_list_id) groupListMap.set(Number(g.id), g.google_list_id);
  }

  // Push local tasks that have no google_task_id
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
        status: (task.status as 'open' | 'done'),
      });
      await db.execute({
        sql: 'UPDATE tasks SET google_task_id = ? WHERE id = ?',
        args: [gt.id, task.id],
      });
    } catch { /* non-fatal */ }
  }
}

const router = Router();

// GET /api/google-tasks/connect
// Accepts ?token= as an alternative to Authorization header (required for browser redirects)
router.get('/connect', (req, res) => {
  // Support token via query param since this is a full-page browser navigation
  const token = (req.query.token as string | undefined) ?? undefined;
  if (token) {
    req.headers['authorization'] = `Bearer ${token}`;
  }

  authenticateToken(req, res, async () => {
    const userId = req.user!.id;
    const state = Buffer.from(String(userId)).toString('base64');
    const userRow = (await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [userId] })).rows[0];
    const url = getTasksAuthUrl(state, (userRow?.email as string | null) ?? undefined);
    res.redirect(url);
  });
});

// GET /api/google-tasks/callback
// Exchanges code, saves tokens, runs full bidirectional sync, redirects to /tasks
router.get('/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  let userId: number;
  try {
    userId = Number(Buffer.from(state, 'base64').toString('utf8'));
    if (!userId || isNaN(userId)) throw new Error('invalid');
  } catch {
    res.status(400).json({ error: 'Invalid state' });
    return;
  }

  const tokens = await exchangeTasksCode(code);

  await db.execute({
    sql: `INSERT INTO google_tasks_tokens (user_id, access_token, refresh_token, expiry, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            access_token  = excluded.access_token,
            refresh_token = COALESCE(excluded.refresh_token, refresh_token),
            expiry        = excluded.expiry,
            updated_at    = datetime('now')`,
    args: [userId, tokens.access_token, tokens.refresh_token, tokens.expiry],
  });

  const auth = getAuthedTasksClient(tokens);

  // Run full bidirectional sync — non-fatal if it fails, user can sync manually
  try {
    await performFullSync(userId, auth);
  } catch { /* non-fatal */ }

  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  res.redirect(`${clientOrigin}/tasks`);
});

// GET /api/google-tasks/task-lists
// Returns the user's Google task lists (used if the UI needs to re-fetch)
router.get('/task-lists', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry FROM google_tasks_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];

  if (!row) {
    res.status(404).json({ error: 'Not connected to Google Tasks' });
    return;
  }

  const auth = getAuthedTasksClient({
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string | null,
    expiry: row.expiry as string | null,
  });
  const lists = await listTaskLists(auth);
  res.json(lists);
});

// POST /api/google-tasks/select-list
// Saves the chosen task list ID for this user
router.post('/select-list', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  const { taskListId } = req.body as { taskListId: string };

  if (!taskListId) {
    res.status(400).json({ error: 'taskListId is required' });
    return;
  }

  await db.execute({
    sql: `UPDATE google_tasks_tokens SET task_list_id = ?, updated_at = datetime('now') WHERE user_id = ?`,
    args: [taskListId, userId],
  });
  res.status(204).send();
});

// GET /api/google-tasks/status
// Returns connection status and selected task list info
router.get('/status', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry, task_list_id FROM google_tasks_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];

  if (!row) {
    res.json({ connected: false, taskListId: null, taskListTitle: null });
    return;
  }

  const taskListId = (row.task_list_id as string | null) ?? null;
  let taskListTitle: string | null = null;

  if (taskListId) {
    try {
      const auth = getAuthedTasksClient({
        access_token: row.access_token as string,
        refresh_token: row.refresh_token as string | null,
        expiry: row.expiry as string | null,
      });
      const lists = await listTaskLists(auth);
      taskListTitle = lists.find((l) => l.id === taskListId)?.title ?? null;
    } catch {
      // Non-fatal — return connected status without title
    }
  }

  res.json({ connected: true, taskListId, taskListTitle });
});

// DELETE /api/google-tasks/disconnect
// Removes tokens, deletes all synced tasks (those with a google_task_id),
// then removes task groups that were synced from Google (those with a google_list_id).
router.delete('/disconnect', authenticateToken, async (req, res) => {
  const userId = req.user!.id;

  // Delete all tasks that originated from Google Tasks
  await db.execute({
    sql: 'DELETE FROM tasks WHERE user_id = ? AND google_task_id IS NOT NULL',
    args: [userId],
  });

  // Remove task groups that were synced from Google, and reset google flags on any remaining groups
  await db.execute({
    sql: 'DELETE FROM task_groups WHERE user_id = ? AND google_list_id IS NOT NULL',
    args: [userId],
  });
  await db.execute({
    sql: 'UPDATE task_groups SET google_list_id = NULL, is_google_default = 0 WHERE user_id = ?',
    args: [userId],
  });

  // Remove the Google Tasks token row
  await db.execute({
    sql: 'DELETE FROM google_tasks_tokens WHERE user_id = ?',
    args: [userId],
  });

  res.status(204).send();
});

// POST /api/google-tasks/sync
// Pulls all tasks from the user's chosen Google task list and upserts into local DB.
// Google wins on conflict.
router.post('/sync', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry, task_list_id FROM google_tasks_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];

  if (!row || !row.task_list_id) {
    res.status(400).json({ error: 'Google Tasks not connected or no task list selected' });
    return;
  }

  const auth = getAuthedTasksClient({
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string | null,
    expiry: row.expiry as string | null,
  });
  const taskListId = row.task_list_id as string;

  const googleTasks = await listGoogleTasks(auth, taskListId);

  for (const gt of googleTasks) {
    const localStatus = gt.status === 'completed' ? 'done' : 'open';
    // due from Google is RFC 3339 (e.g. "2024-01-15T00:00:00.000Z") — store date part only
    const dueDate = gt.due ? gt.due.substring(0, 10) : null;

    const existing = (await db.execute({
      sql: 'SELECT id FROM tasks WHERE google_task_id = ? AND user_id = ?',
      args: [gt.id, userId],
    })).rows[0];

    if (existing) {
      await db.execute({
        sql: `UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ? WHERE id = ? AND user_id = ?`,
        args: [gt.title, gt.notes ?? null, dueDate, localStatus, existing.id, userId],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO tasks (user_id, title, description, due_date, priority, status, google_task_id)
              VALUES (?, ?, ?, ?, 'medium', ?, ?)`,
        args: [userId, gt.title, gt.notes ?? null, dueDate, localStatus, gt.id],
      });
    }
  }

  // Return the full updated task list
  const tasks = (await db.execute({
    sql: 'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  })).rows;

  res.json(tasks);
});

export default router;
