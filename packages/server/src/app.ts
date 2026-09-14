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

// Use express.raw() to capture the body as a Buffer for ALL requests.
// This prevents Vercel's runtime from throwing "Invalid JSON" on multipart bodies.
// Routes that need JSON parse it themselves; multipart routes use the raw buffer directly.
app.use(express.raw({ type: '*/*', limit: '50mb' }));

// For JSON routes, parse req.body Buffer into an object
app.use((req, _res, next) => {
  const ct = req.headers['content-type'] || '';
  if (
    Buffer.isBuffer(req.body) &&
    (ct.includes('application/json') || ct.includes('text/plain'))
  ) {
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch {
      req.body = undefined;
    }
  }
  next();
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
