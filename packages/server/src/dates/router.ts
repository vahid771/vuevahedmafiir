import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';
import { nextOccurrence } from '../utils/dates';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../google/calendar.service';
import { getGoogleCalendarConnection } from '../google/calendar.router';

const router = Router();
router.use(authenticateToken);

type ImportantDateRow = {
  id: number;
  user_id: number;
  title: string;
  date: string;
  recurs_yearly: number;
  notes: string | null;
  created_at: string;
  google_calendar_event_id: string | null;
};

// GET /api/dates
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const rows = (await db.execute({
    sql: 'SELECT * FROM important_dates WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as ImportantDateRow[];

  const result = rows
    .map(r => ({
      ...r,
      next_occurrence: nextOccurrence(r.date, r.recurs_yearly),
    }))
    .sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence));

  res.json(result);
});

// POST /api/dates
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { title, date, recurs_yearly = 0, notes } = req.body as {
    title?: string;
    date?: string;
    recurs_yearly?: number;
    notes?: string;
  };

  if (!title || !date) {
    res.status(400).json({ error: 'title and date are required' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO important_dates (user_id, title, date, recurs_yearly, notes) VALUES (?, ?, ?, ?, ?)',
    args: [userId, title, date, recurs_yearly, notes ?? null],
  });

  const row = await fetchById<ImportantDateRow>('important_dates', result.lastInsertRowid!);

  // Push to Google Calendar (non-fatal)
  try {
    const conn = await getGoogleCalendarConnection(userId);
    if (conn) {
      const gcEvent = await createCalendarEvent(conn.auth, conn.calendarId, {
        summary: row!.title,
        description: row!.notes ?? undefined,
        start: { date: row!.date },
        end: { date: row!.date },
      });
      await db.execute({
        sql: 'UPDATE important_dates SET google_calendar_event_id = ? WHERE id = ?',
        args: [gcEvent.id, row!.id],
      });
      (row as any).google_calendar_event_id = gcEvent.id;
    }
  } catch { /* non-fatal — date is saved locally regardless */ }

  res.status(201).json({ ...row, next_occurrence: nextOccurrence(row!.date, row!.recurs_yearly) });
});

// PATCH /api/dates/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('important_dates', id, userId)) { res.status(404).json({ error: 'Date not found' }); return; }

  const { title, date, recurs_yearly, notes } = req.body as {
    title?: string;
    date?: string;
    recurs_yearly?: number;
    notes?: string | null;
  };

  const { fields, values } = buildPatch({
    title,
    date,
    recurs_yearly,
    notes: notes !== undefined ? (notes ?? null) : undefined,
  });

  if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  values.push(id, userId);
  await db.execute({ sql: `UPDATE important_dates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<ImportantDateRow>('important_dates', id);

  // Push update to Google Calendar (non-fatal)
  try {
    const eventId = updated!.google_calendar_event_id as string | null;
    if (eventId) {
      const conn = await getGoogleCalendarConnection(userId);
      if (conn) {
        await updateCalendarEvent(conn.auth, conn.calendarId, eventId, {
          summary: updated!.title,
          description: updated!.notes ?? undefined,
          start: { date: updated!.date },
          end: { date: updated!.date },
        });
      }
    }
  } catch { /* non-fatal */ }

  res.json({ ...updated, next_occurrence: nextOccurrence(updated!.date, updated!.recurs_yearly) });
});

// DELETE /api/dates/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('important_dates', id, userId)) { res.status(404).json({ error: 'Date not found' }); return; }

  // Fetch google_calendar_event_id before deleting
  const dateRow = (await db.execute({
    sql: 'SELECT google_calendar_event_id FROM important_dates WHERE id = ?',
    args: [id],
  })).rows[0];

  await db.execute({ sql: 'DELETE FROM important_dates WHERE id = ? AND user_id = ?', args: [id, userId] });

  // Delete from Google Calendar (non-fatal)
  try {
    const eventId = dateRow?.google_calendar_event_id as string | null;
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
