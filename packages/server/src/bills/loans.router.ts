import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';

export const loansRouter = Router();
loansRouter.use(authenticateToken);

// GET /api/loans
loansRouter.get('/', async (req, res) => {
  const userId = req.user!.id;
  const loans = (await db.execute({
    sql: 'SELECT * FROM loans WHERE user_id = ? ORDER BY next_payment_date ASC, created_at DESC',
    args: [userId],
  })).rows;
  res.json(loans);
});

// POST /api/loans
loansRouter.post('/', async (req, res) => {
  const userId = req.user!.id;
  const {
    name,
    lender,
    total_amount,
    remaining_amount,
    installment,
    due_day,
    next_payment_date,
    notes,
    active = 1,
  } = req.body as {
    name?: string;
    lender?: string;
    total_amount?: number;
    remaining_amount?: number;
    installment?: number;
    due_day?: number;
    next_payment_date?: string;
    notes?: string;
    active?: number;
  };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (total_amount == null || remaining_amount == null) {
    res.status(400).json({ error: 'total_amount and remaining_amount are required' });
    return;
  }

  const result = await db.execute({
    sql: `INSERT INTO loans
          (user_id, name, lender, total_amount, remaining_amount, installment, due_day, next_payment_date, notes, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId, name, lender ?? null, total_amount, remaining_amount,
      installment ?? null, due_day ?? null, next_payment_date ?? null,
      notes ?? null, active,
    ],
  });

  const loan = await fetchById<object>('loans', result.lastInsertRowid!);
  res.status(201).json(loan);
});

// PATCH /api/loans/:id
loansRouter.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const loanId = Number(req.params.id);

  if (!await assertOwnership('loans', loanId, userId)) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }

  const { name, lender, total_amount, remaining_amount, installment, due_day, next_payment_date, notes, active } = req.body as {
    name?: string;
    lender?: string | null;
    total_amount?: number;
    remaining_amount?: number;
    installment?: number | null;
    due_day?: number | null;
    next_payment_date?: string | null;
    notes?: string | null;
    active?: number;
  };

  const { fields, values } = buildPatch({
    name,
    lender: lender !== undefined ? (lender ?? null) : undefined,
    total_amount,
    remaining_amount,
    installment: installment !== undefined ? (installment ?? null) : undefined,
    due_day: due_day !== undefined ? (due_day ?? null) : undefined,
    next_payment_date: next_payment_date !== undefined ? (next_payment_date ?? null) : undefined,
    notes: notes !== undefined ? (notes ?? null) : undefined,
    active,
  });

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(loanId, userId);
  await db.execute({ sql: `UPDATE loans SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<object>('loans', loanId);
  res.json(updated);
});

// DELETE /api/loans/:id
loansRouter.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const loanId = Number(req.params.id);

  if (!await assertOwnership('loans', loanId, userId)) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }

  await db.execute({ sql: 'DELETE FROM loans WHERE id = ? AND user_id = ?', args: [loanId, userId] });
  res.status(204).send();
});
