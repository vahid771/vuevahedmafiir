import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import {
  getTasksAuthUrl,
  exchangeTasksCode,
  getAuthedTasksClient,
  listTaskLists,
  listGoogleTasks,
} from './tasks.service';

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
// Exchanges code, saves tokens, fetches task lists, redirects to list picker
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
  const lists = await listTaskLists(auth);
  const encodedLists = encodeURIComponent(Buffer.from(JSON.stringify(lists)).toString('base64'));

  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  res.redirect(`${clientOrigin}/settings?gtasks=pick&lists=${encodedLists}`);
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
// Removes tokens and clears google_task_id on all user tasks
router.delete('/disconnect', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  await db.execute({
    sql: 'DELETE FROM google_tasks_tokens WHERE user_id = ?',
    args: [userId],
  });
  await db.execute({
    sql: 'UPDATE tasks SET google_task_id = NULL WHERE user_id = ?',
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
