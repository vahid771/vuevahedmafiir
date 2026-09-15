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
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../google/calendar.service';
import { getGoogleCalendarConnection } from '../google/calendar.router';

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

// GET /api/tasks?status=open|done&group_id=N
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const { status, group_id } = req.query;

  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const args: InValue[] = [userId];

  if (status === 'open' || status === 'done') {
    sql += ' AND status = ?';
    args.push(status);
  }

  if (group_id === 'null') {
    sql += ' AND task_group_id IS NULL';
  } else if (group_id && !isNaN(Number(group_id))) {
    sql += ' AND task_group_id = ?';
    args.push(Number(group_id));
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
    task_group_id,
  } = req.body as {
    title?: string;
    description?: string;
    due_date?: string;
    priority?: string;
    status?: string;
    task_group_id?: number | null;
  };

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO tasks (user_id, title, description, due_date, priority, status, task_group_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [userId, title, description ?? null, due_date ?? null, priority, status, task_group_id ?? null],
  });

  const task = await fetchById<object>('tasks', result.lastInsertRowid!) as any;

  // Push to Google Tasks before responding (fire-and-forget is killed by Vercel on serverless)
  try {
    const conn = await getGoogleTasksConnection(userId);
    if (conn) {
      const gtask = await createGoogleTask(conn.auth, conn.taskListId, {
        title: task.title,
        notes: task.description ?? undefined,
        due: task.due_date ? `${task.due_date}T00:00:00.000Z` : undefined,
        status: (task.status ?? 'open') as 'open' | 'done',
      });
      await db.execute({
        sql: 'UPDATE tasks SET google_task_id = ? WHERE id = ?',
        args: [gtask.id, task.id],
      });
      task.google_task_id = gtask.id;
    }
  } catch { /* non-fatal — task is saved locally regardless */ }

  // Push to Google Calendar (non-fatal, only if due_date present)
  try {
    if (task.due_date) {
      const conn = await getGoogleCalendarConnection(userId);
      if (conn) {
        const gcEvent = await createCalendarEvent(conn.auth, conn.calendarId, {
          summary: `[Task] ${task.title}`,
          description: task.description ?? undefined,
          start: { date: task.due_date },
          end: { date: task.due_date },
        });
        await db.execute({
          sql: 'UPDATE tasks SET google_calendar_event_id = ? WHERE id = ?',
          args: [gcEvent.id, task.id],
        });
        task.google_calendar_event_id = gcEvent.id;
      }
    }
  } catch { /* non-fatal */ }

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

  const updated = await fetchById<object>('tasks', taskId) as any;

  // Push update to Google Tasks before responding
  try {
    const googleTaskId = updated.google_task_id as string | null;
    if (googleTaskId) {
      const conn = await getGoogleTasksConnection(userId);
      if (conn) {
        await updateGoogleTask(conn.auth, conn.taskListId, googleTaskId, {
          title: updated.title,
          notes: updated.description ?? undefined,
          due: updated.due_date ? `${updated.due_date}T00:00:00.000Z` : null,
          status: (updated.status ?? 'open') as 'open' | 'done',
        });
      }
    }
  } catch { /* non-fatal */ }

  // Push update to Google Calendar (non-fatal)
  try {
    const calEventId = updated.google_calendar_event_id as string | null;
    if (calEventId && updated.due_date) {
      // due_date still present — update the event
      const conn = await getGoogleCalendarConnection(userId);
      if (conn) {
        await updateCalendarEvent(conn.auth, conn.calendarId, calEventId, {
          summary: `[Task] ${updated.title}`,
          description: updated.description ?? undefined,
          start: { date: updated.due_date },
          end: { date: updated.due_date },
        });
      }
    } else if (calEventId && !updated.due_date) {
      // due_date was removed — delete calendar event and clear id
      const conn = await getGoogleCalendarConnection(userId);
      if (conn) {
        await deleteCalendarEvent(conn.auth, conn.calendarId, calEventId);
      }
      await db.execute({
        sql: 'UPDATE tasks SET google_calendar_event_id = NULL WHERE id = ?',
        args: [updated.id],
      });
      updated.google_calendar_event_id = null;
    }
  } catch { /* non-fatal */ }

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

  // Fetch google_task_id before deleting
  const taskRow = (
    await db.execute({
      sql: 'SELECT google_task_id, google_calendar_event_id FROM tasks WHERE id = ?',
      args: [taskId],
    })
  ).rows[0];

  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ? AND user_id = ?', args: [taskId, userId] });

  // Delete from Google Tasks before responding
  try {
    const googleTaskId = taskRow?.google_task_id as string | null;
    if (googleTaskId) {
      const conn = await getGoogleTasksConnection(userId);
      if (conn) {
        await deleteGoogleTask(conn.auth, conn.taskListId, googleTaskId);
      }
    }
  } catch { /* non-fatal */ }

  // Delete from Google Calendar (non-fatal)
  try {
    const calEventId = taskRow?.google_calendar_event_id as string | null;
    if (calEventId) {
      const conn = await getGoogleCalendarConnection(userId);
      if (conn) {
        await deleteCalendarEvent(conn.auth, conn.calendarId, calEventId);
      }
    }
  } catch { /* non-fatal */ }

  res.status(204).send();
});

export default router;
