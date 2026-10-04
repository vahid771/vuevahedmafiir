import { Router } from 'express';
import { db } from '../db';
import { createCrudRouter } from '../utils/crudRouter';
import { nextOccurrence } from '../utils/dates';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../google/calendar.service';
import { getGoogleCalendarConnection } from '../google/calendar.router';

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

const crudRouter = createCrudRouter<ImportantDateRow>({
  table: 'important_dates',
  entityType: 'date',
  // Sorted in transformRow after next_occurrence is computed
  orderBy: 'date ASC',

  validateCreate: (body) => {
    if (!body['title'] || !body['date']) return 'title and date are required';
    return null;
  },

  insertSql: (userId, body) => ({
    sql: 'INSERT INTO important_dates (user_id, title, date, recurs_yearly, notes) VALUES (?, ?, ?, ?, ?)',
    args: [
      userId,
      body['title'] as string,
      body['date'] as string,
      (body['recurs_yearly'] as number | undefined) ?? 0,
      (body['notes'] as string | undefined) ?? null,
    ],
  }),

  extractPatch: (body) => ({
    title: body['title'] as string | undefined,
    date: body['date'] as string | undefined,
    recurs_yearly: body['recurs_yearly'] as number | undefined,
    notes: body['notes'] !== undefined ? ((body['notes'] as string | null) ?? null) : undefined,
  }),

  transformRow: (row) => ({
    ...row,
    next_occurrence: nextOccurrence(row.date, row.recurs_yearly),
  }),

  onAfterCreate: async (row, userId) => {
    const conn = await getGoogleCalendarConnection(userId);
    if (!conn) return;
    const gcEvent = await createCalendarEvent(conn.auth, conn.calendarId, {
      summary: row.title,
      description: row.notes ?? undefined,
      start: { date: row.date },
      end: { date: row.date },
    });
    await db.execute({
      sql: 'UPDATE important_dates SET google_calendar_event_id = ? WHERE id = ?',
      args: [gcEvent.id, row.id],
    });
  },

  onAfterUpdate: async (row, userId) => {
    const eventId = row.google_calendar_event_id;
    if (!eventId) return;
    const conn = await getGoogleCalendarConnection(userId);
    if (!conn) return;
    await updateCalendarEvent(conn.auth, conn.calendarId, eventId, {
      summary: row.title,
      description: row.notes ?? undefined,
      start: { date: row.date },
      end: { date: row.date },
    });
  },

  onBeforeDelete: async (row, userId) => {
    const eventId = row.google_calendar_event_id;
    if (!eventId) return;
    const conn = await getGoogleCalendarConnection(userId);
    if (!conn) return;
    await deleteCalendarEvent(conn.auth, conn.calendarId, eventId);
  },
});

const router = Router();
router.use('/', crudRouter);

export default router;
