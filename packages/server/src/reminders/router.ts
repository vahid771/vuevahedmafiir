import { Router } from 'express';
import { db } from '../db';
import { createCrudRouter } from '../utils/crudRouter';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../google/calendar.service';
import { getGoogleCalendarConnection } from '../google/calendar.router';

type ReminderRow = {
  id: number;
  user_id: number;
  title: string;
  remind_at: string;
  notes: string | null;
  done: number;
  google_calendar_event_id: string | null;
  created_at: string;
};

const crudRouter = createCrudRouter<ReminderRow>({
  table: 'reminders',
  entityType: 'reminder',
  orderBy: 'remind_at ASC',

  validateCreate: (body) => {
    if (!body['title'] || !body['remind_at']) return 'title and remind_at are required';
    return null;
  },

  insertSql: (userId, body) => ({
    sql: 'INSERT INTO reminders (user_id, title, remind_at, notes) VALUES (?, ?, ?, ?)',
    args: [userId, body['title'] as string, body['remind_at'] as string, (body['notes'] as string | undefined) ?? null],
  }),

  extractPatch: (body) => ({
    title: body['title'] as string | undefined,
    remind_at: body['remind_at'] as string | undefined,
    notes: body['notes'] !== undefined ? ((body['notes'] as string | null) ?? null) : undefined,
    done: body['done'] as number | undefined,
  }),

  onAfterCreate: async (row, userId) => {
    const conn = await getGoogleCalendarConnection(userId);
    if (!conn) return;
    const remindAtFull = /T\d{2}:\d{2}$/.test(row.remind_at) ? row.remind_at + ':00' : row.remind_at;
    const gcEvent = await createCalendarEvent(conn.auth, conn.calendarId, {
      summary: row.title,
      description: row.notes ?? undefined,
      start: { dateTime: remindAtFull, timeZone: 'UTC' },
      end: { dateTime: remindAtFull, timeZone: 'UTC' },
    });
    await db.execute({
      sql: 'UPDATE reminders SET google_calendar_event_id = ? WHERE id = ?',
      args: [gcEvent.id, row.id],
    });
  },

  onAfterUpdate: async (row, userId) => {
    const eventId = row.google_calendar_event_id;
    if (!eventId) return;
    const conn = await getGoogleCalendarConnection(userId);
    if (!conn) return;
    const remindAtFull = /T\d{2}:\d{2}$/.test(row.remind_at) ? row.remind_at + ':00' : row.remind_at;
    await updateCalendarEvent(conn.auth, conn.calendarId, eventId, {
      summary: row.title,
      description: row.notes ?? undefined,
      start: { dateTime: remindAtFull, timeZone: 'UTC' },
      end: { dateTime: remindAtFull, timeZone: 'UTC' },
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
