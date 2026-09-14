import express, { NextFunction, Request, Response } from 'express';
import authRouter from './auth/router';
import tasksRouter from './tasks/router';
import { billsRouter, subscriptionsRouter } from './bills/router';
import remindersRouter from './reminders/router';
import habitsRouter from './habits/router';
import datesRouter from './dates/router';
import documentsRouter from './documents/router';
import aiRouter from './ai/router';
import preferencesRouter from './preferences/router';
import googleRouter from './google/router';

const app = express();

// Vercel's Rust runtime installs a body getter on IncomingMessage that throws for non-JSON.
// We bypass ALL Express body parsers and handle body reading manually per-route.
// JSON routes: body parsed in this middleware. Multipart routes: busboy reads req directly.
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  // Skip body reading for multipart — busboy handles it in the route
  if (ct.startsWith('multipart/form-data')) return next();
  // For everything else, drain the stream into a buffer and parse if JSON
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/bills', billsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/dates', datesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api/google', googleRouter);

// 404 handler for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

export default app;
