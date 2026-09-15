import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import {
  getCalendarAuthUrl,
  exchangeCalendarCode,
  getAuthedCalendarClient,
  listCalendarEvents,
  createCalendarEvent,
} from './calendar.service';
import { nextOccurrence } from '../utils/dates';
import type { OAuth2Client } from 'google-auth-library';

const router = Router();

// GET /api/google-calendar/connect
// Accepts ?token= query param since this is a full-page browser navigation
router.get('/connect', (req, res) => {
  const token = (req.query.token as string | undefined) ?? undefined;
  if (token) {
    req.headers['authorization'] = `Bearer ${token}`;
  }

  authenticateToken(req, res, async () => {
    const userId = req.user!.id;
    const state = Buffer.from(String(userId)).toString('base64');
    const userRow = (await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [userId] })).rows[0];
    const url = getCalendarAuthUrl(state, (userRow?.email as string | null) ?? undefined);
    res.redirect(url);
  });
});

// GET /api/google-calendar/callback
// Exchanges code, saves tokens with calendar_id='primary', redirects to settings
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

  const tokens = await exchangeCalendarCode(code);

  await db.execute({
    sql: `INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expiry, calendar_id, updated_at)
          VALUES (?, ?, ?, ?, 'primary', datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            access_token  = excluded.access_token,
            refresh_token = COALESCE(excluded.refresh_token, refresh_token),
            expiry        = excluded.expiry,
            calendar_id   = 'primary',
            updated_at    = datetime('now')`,
    args: [userId, tokens.access_token, tokens.refresh_token, tokens.expiry],
  });

  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

  // Back-fill: push all existing local items that don't yet have a google_calendar_event_id
  try {
    const auth = getAuthedCalendarClient(tokens);
    const calendarId = 'primary';

    // Important dates
    const existingDates = (await db.execute({
      sql: 'SELECT * FROM important_dates WHERE user_id = ? AND (google_calendar_event_id IS NULL OR google_calendar_event_id = "")',
      args: [userId],
    })).rows;
    for (const d of existingDates) {
      try {
        const gcEvent = await createCalendarEvent(auth, calendarId, {
          summary: d.title as string,
          description: (d.notes as string | null) ?? undefined,
          start: { date: d.date as string },
          end: { date: d.date as string },
        });
        await db.execute({
          sql: 'UPDATE important_dates SET google_calendar_event_id = ? WHERE id = ?',
          args: [gcEvent.id, d.id],
        });
      } catch { /* skip individual failures */ }
    }

    // Reminders
    const existingReminders = (await db.execute({
      sql: 'SELECT * FROM reminders WHERE user_id = ? AND (google_calendar_event_id IS NULL OR google_calendar_event_id = "")',
      args: [userId],
    })).rows;
    for (const r of existingReminders) {
      try {
        const remindAt = r.remind_at as string;
        const remindAtFull = /T\d{2}:\d{2}$/.test(remindAt) ? remindAt + ':00' : remindAt;
        const gcEvent = await createCalendarEvent(auth, calendarId, {
          summary: r.title as string,
          description: (r.notes as string | null) ?? undefined,
          start: { dateTime: remindAtFull, timeZone: 'UTC' },
          end: { dateTime: remindAtFull, timeZone: 'UTC' },
        });
        await db.execute({
          sql: 'UPDATE reminders SET google_calendar_event_id = ? WHERE id = ?',
          args: [gcEvent.id, r.id],
        });
      } catch { /* skip individual failures */ }
    }

    // Tasks with due_date
    const existingTasks = (await db.execute({
      sql: 'SELECT * FROM tasks WHERE user_id = ? AND due_date IS NOT NULL AND (google_calendar_event_id IS NULL OR google_calendar_event_id = "")',
      args: [userId],
    })).rows;
    for (const t of existingTasks) {
      try {
        const gcEvent = await createCalendarEvent(auth, calendarId, {
          summary: `[Task] ${t.title as string}`,
          description: (t.description as string | null) ?? undefined,
          start: { date: t.due_date as string },
          end: { date: t.due_date as string },
        });
        await db.execute({
          sql: 'UPDATE tasks SET google_calendar_event_id = ? WHERE id = ?',
          args: [gcEvent.id, t.id],
        });
      } catch { /* skip individual failures */ }
    }
  } catch { /* back-fill is non-fatal */ }

  res.redirect(`${clientOrigin}/settings?gcal=connected`);
});

// GET /api/google-calendar/status
// Returns { connected: boolean }
router.get('/status', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  const row = (await db.execute({
    sql: 'SELECT id FROM google_calendar_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];

  res.json({ connected: !!row });
});

// DELETE /api/google-calendar/disconnect
// Removes tokens and clears google_calendar_event_id on all three tables
router.delete('/disconnect', authenticateToken, async (req, res) => {
  const userId = req.user!.id;

  await db.execute({
    sql: 'DELETE FROM google_calendar_tokens WHERE user_id = ?',
    args: [userId],
  });
  await db.execute({
    sql: 'UPDATE reminders SET google_calendar_event_id = NULL WHERE user_id = ?',
    args: [userId],
  });
  await db.execute({
    sql: 'UPDATE important_dates SET google_calendar_event_id = NULL WHERE user_id = ?',
    args: [userId],
  });
  await db.execute({
    sql: 'UPDATE tasks SET google_calendar_event_id = NULL WHERE user_id = ?',
    args: [userId],
  });

  res.status(204).send();
});

// POST /api/google-calendar/sync
// Pulls all events from primary calendar, upserts locally using mapping rules,
// returns { reminders, dates, tasks } (full collections for user after upsert)
router.post('/sync', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry, calendar_id FROM google_calendar_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];

  if (!row) {
    res.status(400).json({ error: 'Google Calendar not connected' });
    return;
  }

  const auth = getAuthedCalendarClient({
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string | null,
    expiry: row.expiry as string | null,
  });
  const calendarId = (row.calendar_id as string | null) ?? 'primary';

  const events = await listCalendarEvents(auth, calendarId);

  // Collect event IDs by type so we can delete orphaned local records after upsert
  const gcalTaskIds: string[] = [];
  const gcalReminderIds: string[] = [];
  const gcalDateIds: string[] = [];

  for (const event of events) {
    const isTask = event.summary.startsWith('[Task] ') && !!event.start.dateTime;
    const isTimedReminder = !isTask && !!event.start.dateTime;
    const isAllDay = !isTask && !!event.start.date && !event.start.dateTime;

    if (isTask) {
      gcalTaskIds.push(event.id);
      const title = event.summary.slice('[Task] '.length);
      const dueDate = event.start.dateTime!.substring(0, 10);
      const existing = (await db.execute({
        sql: 'SELECT id FROM tasks WHERE google_calendar_event_id = ? AND user_id = ?',
        args: [event.id, userId],
      })).rows[0];
      if (existing) {
        await db.execute({
          sql: `UPDATE tasks SET title = ?, description = ?, due_date = ? WHERE id = ? AND user_id = ?`,
          args: [title, event.description ?? null, dueDate, existing.id, userId],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO tasks (user_id, title, description, due_date, priority, status, google_calendar_event_id)
                VALUES (?, ?, ?, ?, 'medium', 'open', ?)`,
          args: [userId, title, event.description ?? null, dueDate, event.id],
        });
      }
    } else if (isTimedReminder) {
      gcalReminderIds.push(event.id);
      const existing = (await db.execute({
        sql: 'SELECT id FROM reminders WHERE google_calendar_event_id = ? AND user_id = ?',
        args: [event.id, userId],
      })).rows[0];
      if (existing) {
        await db.execute({
          sql: `UPDATE reminders SET title = ?, notes = ?, remind_at = ? WHERE id = ? AND user_id = ?`,
          args: [event.summary, event.description ?? null, event.start.dateTime!, existing.id, userId],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO reminders (user_id, title, notes, remind_at, done, google_calendar_event_id)
                VALUES (?, ?, ?, ?, 0, ?)`,
          args: [userId, event.summary, event.description ?? null, event.start.dateTime!, event.id],
        });
      }
    } else if (isAllDay) {
      gcalDateIds.push(event.id);
      const existing = (await db.execute({
        sql: 'SELECT id FROM important_dates WHERE google_calendar_event_id = ? AND user_id = ?',
        args: [event.id, userId],
      })).rows[0];
      if (existing) {
        await db.execute({
          sql: `UPDATE important_dates SET title = ?, notes = ?, date = ? WHERE id = ? AND user_id = ?`,
          args: [event.summary, event.description ?? null, event.start.date!, existing.id, userId],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO important_dates (user_id, title, notes, date, recurs_yearly, google_calendar_event_id)
                VALUES (?, ?, ?, ?, 0, ?)`,
          args: [userId, event.summary, event.description ?? null, event.start.date!, event.id],
        });
      }
    }
  }

  // Delete local records whose google_calendar_event_id is no longer in Google Calendar
  if (gcalDateIds.length > 0) {
    const placeholders = gcalDateIds.map(() => '?').join(', ');
    await db.execute({
      sql: `DELETE FROM important_dates WHERE user_id = ? AND google_calendar_event_id IS NOT NULL AND google_calendar_event_id NOT IN (${placeholders})`,
      args: [userId, ...gcalDateIds],
    });
  } else {
    // All calendar-originated dates were removed from Google — delete them all
    await db.execute({
      sql: `DELETE FROM important_dates WHERE user_id = ? AND google_calendar_event_id IS NOT NULL`,
      args: [userId],
    });
  }

  if (gcalReminderIds.length > 0) {
    const placeholders = gcalReminderIds.map(() => '?').join(', ');
    await db.execute({
      sql: `DELETE FROM reminders WHERE user_id = ? AND google_calendar_event_id IS NOT NULL AND google_calendar_event_id NOT IN (${placeholders})`,
      args: [userId, ...gcalReminderIds],
    });
  } else {
    await db.execute({
      sql: `DELETE FROM reminders WHERE user_id = ? AND google_calendar_event_id IS NOT NULL`,
      args: [userId],
    });
  }

  if (gcalTaskIds.length > 0) {
    const placeholders = gcalTaskIds.map(() => '?').join(', ');
    await db.execute({
      sql: `DELETE FROM tasks WHERE user_id = ? AND google_calendar_event_id IS NOT NULL AND google_calendar_event_id NOT IN (${placeholders})`,
      args: [userId, ...gcalTaskIds],
    });
  } else {
    await db.execute({
      sql: `DELETE FROM tasks WHERE user_id = ? AND google_calendar_event_id IS NOT NULL`,
      args: [userId],
    });
  }

  const [reminders, datesResult, tasks] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM reminders WHERE user_id = ? ORDER BY created_at DESC', args: [userId] }),
    db.execute({ sql: 'SELECT * FROM important_dates WHERE user_id = ? ORDER BY date ASC', args: [userId] }),
    db.execute({ sql: 'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', args: [userId] }),
  ]);

  const datesWithOccurrence = datesResult.rows.map((r: any) => ({
    ...r,
    next_occurrence: nextOccurrence(r.date, r.recurs_yearly),
  }));

  res.json({ reminders: reminders.rows, dates: datesWithOccurrence, tasks: tasks.rows });
});

export default router;

// Helper used by other routers (Sub-Task 4) to get an authenticated calendar client + calendarId
export async function getGoogleCalendarConnection(
  userId: number,
): Promise<{ auth: OAuth2Client; calendarId: string } | null> {
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry, calendar_id FROM google_calendar_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];

  if (!row) return null;

  const auth = getAuthedCalendarClient({
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string | null,
    expiry: row.expiry as string | null,
  });

  return { auth, calendarId: (row.calendar_id as string | null) ?? 'primary' };
}
