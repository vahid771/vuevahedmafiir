import express, { NextFunction, Request, Response } from 'express';
import authRouter from './auth/router';
import tasksRouter from './tasks/router';
import { billsRouter, subscriptionsRouter } from './bills/router';
import remindersRouter from './reminders/router';
import habitsRouter from './habits/router';
import datesRouter from './dates/router';
import documentsRouter from './documents/router';
import aiRouter from './ai/router';

const app = express();

app.use(express.json());

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
