import { Router } from 'express';
import Groq from 'groq-sdk';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from '../utils/db';
import { getWeekBounds } from '../utils/dates';
import { computeStreak } from './service';

/**
 * Translate a habit name into both English and Persian using Groq.
 * Returns { name_en, name_fa } on success, or null on any failure so the
 * caller can store NULL and retry on next load.
 */
async function translateHabitName(name: string): Promise<{ name_en: string; name_fa: string } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[translateHabitName] GROQ_API_KEY not set — skipping translation');
    return null;
  }
  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'groq/compound-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a translation assistant. You MUST respond with ONLY a raw JSON object — no markdown, no explanation, nothing else. The JSON must have exactly two string keys: "name_en" (habit name in English) and "name_fa" (habit name in Persian/Farsi). Keep the translation concise — it is a short habit name. Example: {"name_en":"Drink water","name_fa":"نوشیدن آب"}',
        },
        {
          role: 'user',
          content: `Translate this habit name: "${name}"`,
        },
      ],
      max_tokens: 120,
    });
    const raw = (completion.choices[0]?.message?.content ?? '').trim();
    console.log(`[translateHabitName] raw for "${name}":`, raw);

    const cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();

    let name_en: string | null = null;
    let name_fa: string | null = null;

    try {
      const parsed = JSON.parse(cleaned) as { name_en?: string; name_fa?: string };
      name_en = (parsed.name_en ?? '').trim() || null;
      name_fa = (parsed.name_fa ?? '').trim() || null;
    } catch {
      // Regex fallback
      const enMatch = cleaned.match(/"name_en"\s*:\s*"([^"]+)"/);
      const faMatch = cleaned.match(/"name_fa"\s*:\s*"([^"]+)"/);
      name_en = enMatch ? enMatch[1].trim() : null;
      name_fa = faMatch ? faMatch[1].trim() : null;
    }

    if (!name_en || !name_fa) {
      console.error(`[translateHabitName] incomplete result for "${name}": en=${name_en} fa=${name_fa} raw=${raw}`);
      return null;
    }

    console.log(`[translateHabitName] ok: en="${name_en}" fa="${name_fa}"`);
    return { name_en, name_fa };
  } catch (err) {
    console.error('[translateHabitName] Groq error:', err instanceof Error ? err.message : err);
    return null;
  }
}

const router = Router();
router.use(authenticateToken);

// GET /api/habits
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const habits = (await db.execute({
    sql: 'SELECT * FROM habits WHERE user_id = ? ORDER BY created_at ASC',
    args: [userId],
  })).rows as unknown as {
    id: number;
    user_id: number;
    name: string;
    name_en: string | null;
    name_fa: string | null;
    frequency: string;
    target_days: string;
    created_at: string;
  }[];

  // Backfill any habits that are missing translations (e.g. created before migration)
  await Promise.all(habits.map(async h => {
    if (h.name_en && h.name_fa) return;
    const t = await translateHabitName(h.name);
    if (!t) return; // Groq unavailable — leave NULL, retry next load
    await db.execute({
      sql: 'UPDATE habits SET name_en = ?, name_fa = ? WHERE id = ? AND user_id = ?',
      args: [t.name_en, t.name_fa, h.id, userId],
    });
    h.name_en = t.name_en;
    h.name_fa = t.name_fa;
  }));

  const { start: monday, end: sunday } = getWeekBounds();

  const result = await Promise.all(habits.map(async h => {
    const logs = (await db.execute({
      sql: 'SELECT logged_date FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date BETWEEN ? AND ?',
      args: [h.id, userId, monday, sunday],
    })).rows as unknown as { logged_date: string }[];

    return {
      ...h,
      logs_this_week: logs.map(l => l.logged_date),
      current_streak: await computeStreak(Number(h.id), userId),
    };
  }));

  res.json(result);
});

// POST /api/habits
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { name, frequency = 'daily', target_days = '[]' } = req.body as {
    name?: string;
    frequency?: string;
    target_days?: string;
  };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const t = await translateHabitName(name);

  const result = await db.execute({
    sql: 'INSERT INTO habits (user_id, name, frequency, target_days, name_en, name_fa) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, name, frequency, target_days, t?.name_en ?? null, t?.name_fa ?? null],
  });

  const habit = await fetchById<object>('habits', result.lastInsertRowid!);
  res.status(201).json(habit);
});

// PATCH /api/habits/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('habits', id, userId)) { res.status(404).json({ error: 'Habit not found' }); return; }

  const { name, frequency, target_days } = req.body as {
    name?: string;
    frequency?: string;
    target_days?: string;
  };

  // If the name is being changed, re-translate both language columns
  const t = name ? await translateHabitName(name) : null;
  const translations = t ? { name_en: t.name_en, name_fa: t.name_fa } : name ? { name_en: null, name_fa: null } : {};
  const { fields, values } = buildPatch({ name, frequency, target_days, ...translations });

  if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  values.push(id, userId);
  await db.execute({ sql: `UPDATE habits SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });

  const updated = await fetchById<object>('habits', id);
  res.json(updated);
});

// DELETE /api/habits/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!await assertOwnership('habits', id, userId)) { res.status(404).json({ error: 'Habit not found' }); return; }

  await db.execute({ sql: 'DELETE FROM habits WHERE id = ? AND user_id = ?', args: [id, userId] });
  res.status(204).send();
});

// POST /api/habits/:id/log
router.post('/:id/log', async (req, res) => {
  const userId = req.user!.id;
  const habitId = Number(req.params.id);

  if (!await assertOwnership('habits', habitId, userId)) { res.status(404).json({ error: 'Habit not found' }); return; }

  const today = new Date().toISOString().slice(0, 10);

  // Idempotent insert
  await db.execute({
    sql: 'INSERT OR IGNORE INTO habit_logs (habit_id, user_id, logged_date) VALUES (?, ?, ?)',
    args: [habitId, userId, today],
  });

  res.status(201).json({ logged_date: today });
});

// DELETE /api/habits/:id/log/:date
router.delete('/:id/log/:date', async (req, res) => {
  const userId = req.user!.id;
  const habitId = Number(req.params.id);
  const date = req.params.date;

  const result = await db.execute({
    sql: 'DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date = ?',
    args: [habitId, userId, date],
  });

  if (result.rowsAffected === 0) {
    res.status(404).json({ error: 'Log not found' });
    return;
  }

  res.status(204).send();
});

export default router;
