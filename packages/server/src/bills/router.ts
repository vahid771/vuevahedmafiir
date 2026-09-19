import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';

// ─── Bills Router ─────────────────────────────────────────────────────────────

export const billsRouter = Router();
billsRouter.use(authenticateToken);

// GET /api/bills
billsRouter.get('/', async (req, res) => {
  const userId = req.user!.id;
  const bills = (await db.execute({
    sql: 'SELECT * FROM bills WHERE user_id = ? ORDER BY due_date ASC, created_at DESC',
    args: [userId],
  })).rows;
  res.json(bills);
});

// POST /api/bills
billsRouter.post('/', async (req, res) => {
  const userId = req.user!.id;
  const {
    name,
    amount,
    due_date,
    recurrence = 'once',
    paid = 0,
  } = req.body as {
    name?: string;
    amount?: number;
    due_date?: string;
    recurrence?: string;
    paid?: number;
  };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO bills (user_id, name, amount, due_date, recurrence, paid) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, name, amount ?? null, due_date ?? null, recurrence, paid],
  });

  const bill = await fetchById<object>('bills', result.lastInsertRowid!);
  res.status(201).json(bill);
});

// PATCH /api/bills/:id
billsRouter.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const billId = Number(req.params.id);

  if (!await assertOwnership('bills', billId, userId)) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  const { name, amount, due_date, recurrence, paid } = req.body as {
    name?: string;
    amount?: number | null;
    due_date?: string | null;
    recurrence?: string;
    paid?: number;
  };

  const { fields, values } = buildPatch({
    name,
    amount: amount !== undefined ? (amount ?? null) : undefined,
    due_date: due_date !== undefined ? (due_date ?? null) : undefined,
    recurrence,
    paid,
  });

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(billId, userId);
  await db.execute({ sql: `UPDATE bills SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<object>('bills', billId);
  res.json(updated);
});

// DELETE /api/bills/:id
billsRouter.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const billId = Number(req.params.id);

  if (!await assertOwnership('bills', billId, userId)) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  await db.execute({ sql: 'DELETE FROM bills WHERE id = ? AND user_id = ?', args: [billId, userId] });
  res.status(204).send();
});

// ─── Subscriptions Router ─────────────────────────────────────────────────────

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authenticateToken);

// GET /api/subscriptions
subscriptionsRouter.get('/', async (req, res) => {
  const userId = req.user!.id;
  const subs = (await db.execute({
    sql: 'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_billing_date ASC, created_at DESC',
    args: [userId],
  })).rows;
  res.json(subs);
});

// POST /api/subscriptions
subscriptionsRouter.post('/', async (req, res) => {
  const userId = req.user!.id;
  const {
    name,
    amount,
    billing_cycle,
    next_billing_date,
    active = 1,
    max_repetitions,
  } = req.body as {
    name?: string;
    amount?: number;
    billing_cycle?: string;
    next_billing_date?: string;
    active?: number;
    max_repetitions?: number | null;
  };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing_date, active, max_repetitions) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [userId, name, amount ?? null, billing_cycle ?? null, next_billing_date ?? null, active, max_repetitions ?? null],
  });

  const sub = await fetchById<object>('subscriptions', result.lastInsertRowid!);
  res.status(201).json(sub);
});

// PATCH /api/subscriptions/:id
subscriptionsRouter.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const subId = Number(req.params.id);

  if (!await assertOwnership('subscriptions', subId, userId)) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  const { name, amount, billing_cycle, next_billing_date, active, max_repetitions } = req.body as {
    name?: string;
    amount?: number | null;
    billing_cycle?: string | null;
    next_billing_date?: string | null;
    active?: number;
    max_repetitions?: number | null;
  };

  const { fields, values } = buildPatch({
    name,
    amount: amount !== undefined ? (amount ?? null) : undefined,
    billing_cycle: billing_cycle !== undefined ? (billing_cycle ?? null) : undefined,
    next_billing_date: next_billing_date !== undefined ? (next_billing_date ?? null) : undefined,
    active,
    max_repetitions: max_repetitions !== undefined ? (max_repetitions ?? null) : undefined,
  });

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(subId, userId);
  await db.execute({ sql: `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<object>('subscriptions', subId);
  res.json(updated);
});

// DELETE /api/subscriptions/:id
subscriptionsRouter.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const subId = Number(req.params.id);

  if (!await assertOwnership('subscriptions', subId, userId)) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  await db.execute({ sql: 'DELETE FROM subscriptions WHERE id = ? AND user_id = ?', args: [subId, userId] });
  res.status(204).send();
});
