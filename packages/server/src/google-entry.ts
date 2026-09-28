import express from 'express';
import documentsRouter from './documents/router';
import googleRouter from './google/router';
import googleTasksRouter from './google/tasks.router';
import googleCalendarRouter from './google/calendar.router';
import { runMigrations } from './db';

const app = express();

runMigrations().catch(e => console.error('[google-entry] migration error:', e));

app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) return next();
  if (req.body !== undefined) return next();
  if (!(req as any).readable) {
    if (ct.includes('application/json') && req.body === undefined) req.body = {};
    return next();
  }
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    if (ct.includes('application/json') && raw.length > 0) {
      try { req.body = JSON.parse(raw.toString('utf8')); } catch { req.body = {}; }
    }
    next();
  });
  req.on('error', () => next());
});

app.use('/api/documents', documentsRouter);
app.use('/api/google', googleRouter);
app.use('/api/google-tasks', googleTasksRouter);
app.use('/api/google-calendar', googleCalendarRouter);

export default app;
