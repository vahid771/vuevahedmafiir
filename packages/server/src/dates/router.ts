import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';

const router = Router();
router.use(authenticateToken);

function nextOccurrence(dateStr: string, recurs_yearly: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(dateStr + 'T00:00:00');
  if (!recurs_yearly) return dateStr;

  d.setFullYear(today.getFullYear());
  if (d < today) d.setFullYear(today.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type ImportantDateRow = {
  id: number;
  user_id: number;
  title: string;
  date: string;
  recurs_yearly: number;
  notes: string | null;
  created_at: string;
};

// GET /api/dates
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const rows = (await db.execute({
    sql: 'SELECT * FROM important_dates WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as ImportantDateRow[];

  const result = rows
    .map(r => ({
      ...r,
      next_occurrence: nextOccurrence(r.date, r.recurs_yearly),
    }))
    .sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence));

  res.json(result);
});

// POST /api/dates
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { title, date, recurs_yearly = 0, notes } = req.body as {
    title?: string;
    date?: string;
    recurs_yearly?: number;
    notes?: string;
  };

  if (!title || !date) {
    res.status(400).json({ error: 'title and date are required' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO important_dates (user_id, title, date, recurs_yearly, notes) VALUES (?, ?, ?, ?, ?)',
    args: [userId, title, date, recurs_yearly, notes ?? null],
  });

  const row = await fetchById<ImportantDateRow>('important_dates', result.lastInsertRowid!);
  res.status(201).json({ ...row, next_occurrence: nextOccurrence(row!.date, row!.recurs_yearly) });
});

// PATCH /api/dates/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('important_dates', id, userId)) { res.status(404).json({ error: 'Date not found' }); return; }

  const { title, date, recurs_yearly, notes } = req.body as {
    title?: string;
    date?: string;
    recurs_yearly?: number;
    notes?: string | null;
  };

  const { fields, values } = buildPatch({
    title,
    date,
    recurs_yearly,
    notes: notes !== undefined ? (notes ?? null) : undefined,
  });

  if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  values.push(id, userId);
  await db.execute({ sql: `UPDATE important_dates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<ImportantDateRow>('important_dates', id);
  res.json({ ...updated, next_occurrence: nextOccurrence(updated!.date, updated!.recurs_yearly) });
});

// DELETE /api/dates/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('important_dates', id, userId)) { res.status(404).json({ error: 'Date not found' }); return; }

  await db.execute({ sql: 'DELETE FROM important_dates WHERE id = ? AND user_id = ?', args: [id, userId] });
  res.status(204).send();
});

export default router;
