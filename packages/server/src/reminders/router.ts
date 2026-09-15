import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../google/calendar.service';
import { getGoogleCalendarConnection } from '../google/calendar.router';

const router = Router();
router.use(authenticateToken);

// GET /api/reminders
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const reminders = (await db.execute({
    sql: 'SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC',
    args: [userId],
  })).rows;
  res.json(reminders);
});

// POST /api/reminders
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { title, remind_at, notes } = req.body as {
    title?: string;
    remind_at?: string;
    notes?: string;
  };

  if (!title || !remind_at) {
    res.status(400).json({ error: 'title and remind_at are required' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO reminders (user_id, title, remind_at, notes) VALUES (?, ?, ?, ?)',
    args: [userId, title, remind_at, notes ?? null],
  });

  const reminder = await fetchById<object>('reminders', result.lastInsertRowid!) as any;

  // Push to Google Calendar (non-fatal)
  try {
    const conn = await getGoogleCalendarConnection(userId);
    if (conn) {
      // Google Calendar requires full ISO 8601 with seconds; datetime-local inputs omit them
      const remindAtFull = /T\d{2}:\d{2}$/.test(reminder.remind_at)
        ? reminder.remind_at + ':00'
        : reminder.remind_at;
      const gcEvent = await createCalendarEvent(conn.auth, conn.calendarId, {
        summary: reminder.title,
        description: reminder.notes ?? undefined,
        start: { dateTime: remindAtFull, timeZone: 'UTC' },
        end: { dateTime: remindAtFull, timeZone: 'UTC' },
      });
      await db.execute({
        sql: 'UPDATE reminders SET google_calendar_event_id = ? WHERE id = ?',
        args: [gcEvent.id, reminder.id],
      });
      reminder.google_calendar_event_id = gcEvent.id;
    }
  } catch { /* non-fatal */ }

  res.status(201).json(reminder);
});

// PATCH /api/reminders/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('reminders', id, userId)) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  const { title, remind_at, notes, done } = req.body as {
    title?: string;
    remind_at?: string;
    notes?: string | null;
    done?: number;
  };

  const { fields, values } = buildPatch({
    title,
    remind_at,
    notes: notes !== undefined ? (notes ?? null) : undefined,
    done,
  });

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id, userId);
  await db.execute({ sql: `UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<object>('reminders', id) as any;

  // Push update to Google Calendar (non-fatal)
  try {
    const eventId = updated.google_calendar_event_id as string | null;
    if (eventId) {
      const conn = await getGoogleCalendarConnection(userId);
      if (conn) {
        const remindAtFull = /T\d{2}:\d{2}$/.test(updated.remind_at)
          ? updated.remind_at + ':00'
          : updated.remind_at;
        await updateCalendarEvent(conn.auth, conn.calendarId, eventId, {
          summary: updated.title,
          description: updated.notes ?? undefined,
          start: { dateTime: remindAtFull, timeZone: 'UTC' },
          end: { dateTime: remindAtFull, timeZone: 'UTC' },
        });
      }
    }
  } catch { /* non-fatal */ }

  res.json(updated);
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('reminders', id, userId)) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  // Fetch google_calendar_event_id before deleting
  const reminderRow = (await db.execute({
    sql: 'SELECT google_calendar_event_id FROM reminders WHERE id = ?',
    args: [id],
  })).rows[0];

  await db.execute({ sql: 'DELETE FROM reminders WHERE id = ? AND user_id = ?', args: [id, userId] });

  // Delete from Google Calendar (non-fatal)
  try {
    const eventId = reminderRow?.google_calendar_event_id as string | null;
    if (eventId) {
      const conn = await getGoogleCalendarConnection(userId);
      if (conn) {
        await deleteCalendarEvent(conn.auth, conn.calendarId, eventId);
      }
    }
  } catch { /* non-fatal */ }

  res.status(204).send();
});

export default router;
