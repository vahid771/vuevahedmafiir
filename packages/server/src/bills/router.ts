import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

// ─── Bills Router ─────────────────────────────────────────────────────────────

export const billsRouter = Router();
billsRouter.use(authenticateToken);

// GET /api/bills
billsRouter.get('/', (req, res) => {
  const userId = req.user!.id;
  const bills = db
    .prepare('SELECT * FROM bills WHERE user_id = ? ORDER BY due_date ASC, created_at DESC')
    .all(userId);
  res.json(bills);
});

// POST /api/bills
billsRouter.post('/', (req, res) => {
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

  const result = db
    .prepare(
      'INSERT INTO bills (user_id, name, amount, due_date, recurrence, paid) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(userId, name, amount ?? null, due_date ?? null, recurrence, paid);

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(bill);
});

// PATCH /api/bills/:id
billsRouter.patch('/:id', (req, res) => {
  const userId = req.user!.id;
  const billId = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM bills WHERE id = ? AND user_id = ?')
    .get(billId, userId);

  if (!existing) {
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

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (amount !== undefined) { fields.push('amount = ?'); values.push(amount); }
  if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date); }
  if (recurrence !== undefined) { fields.push('recurrence = ?'); values.push(recurrence); }
  if (paid !== undefined) { fields.push('paid = ?'); values.push(paid); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(billId, userId);
  db.prepare(`UPDATE bills SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  res.json(updated);
});

// DELETE /api/bills/:id
billsRouter.delete('/:id', (req, res) => {
  const userId = req.user!.id;
  const billId = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM bills WHERE id = ? AND user_id = ?')
    .get(billId, userId);

  if (!existing) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  db.prepare('DELETE FROM bills WHERE id = ? AND user_id = ?').run(billId, userId);
  res.status(204).send();
});

// ─── Subscriptions Router ─────────────────────────────────────────────────────

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authenticateToken);

// GET /api/subscriptions
subscriptionsRouter.get('/', (req, res) => {
  const userId = req.user!.id;
  const subs = db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_billing_date ASC, created_at DESC')
    .all(userId);
  res.json(subs);
});

// POST /api/subscriptions
subscriptionsRouter.post('/', (req, res) => {
  const userId = req.user!.id;
  const {
    name,
    amount,
    billing_cycle,
    next_billing_date,
    active = 1,
  } = req.body as {
    name?: string;
    amount?: number;
    billing_cycle?: string;
    next_billing_date?: string;
    active?: number;
  };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = db
    .prepare(
      'INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing_date, active) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(userId, name, amount ?? null, billing_cycle ?? null, next_billing_date ?? null, active);

  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(sub);
});

// PATCH /api/subscriptions/:id
subscriptionsRouter.patch('/:id', (req, res) => {
  const userId = req.user!.id;
  const subId = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM subscriptions WHERE id = ? AND user_id = ?')
    .get(subId, userId);

  if (!existing) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  const { name, amount, billing_cycle, next_billing_date, active } = req.body as {
    name?: string;
    amount?: number | null;
    billing_cycle?: string | null;
    next_billing_date?: string | null;
    active?: number;
  };

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (amount !== undefined) { fields.push('amount = ?'); values.push(amount); }
  if (billing_cycle !== undefined) { fields.push('billing_cycle = ?'); values.push(billing_cycle); }
  if (next_billing_date !== undefined) { fields.push('next_billing_date = ?'); values.push(next_billing_date); }
  if (active !== undefined) { fields.push('active = ?'); values.push(active); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(subId, userId);
  db.prepare(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);
  res.json(updated);
});

// DELETE /api/subscriptions/:id
subscriptionsRouter.delete('/:id', (req, res) => {
  const userId = req.user!.id;
  const subId = Number(req.params.id);

  const existing = db
    .prepare('SELECT id FROM subscriptions WHERE id = ? AND user_id = ?')
    .get(subId, userId);

  if (!existing) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').run(subId, userId);
  res.status(204).send();
});
