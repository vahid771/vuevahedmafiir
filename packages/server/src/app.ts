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

// On Vercel, the Rust runtime pre-reads the body into req.body as a Buffer before Express runs.
// For multipart requests this causes express.json() to throw "Invalid JSON".
// We intercept early: clear req.body for multipart so json() skips it, then catch any stray errors.
app.use((req, _res, next) => {
  if (req.headers['content-type']?.startsWith('multipart/form-data')) {
    // Store the raw buffer so our busboy parser can use it, then clear req.body
    (req as any)._rawBody = req.body;
    (req as any).body = undefined;
  }
  next();
});
app.use((req, res, next) => {
  if (req.headers['content-type']?.startsWith('multipart/form-data')) return next();
  express.json()(req, res, (err) => {
    if (err) return next(); // swallow JSON parse errors for non-multipart too, just in case
    next();
  });
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
