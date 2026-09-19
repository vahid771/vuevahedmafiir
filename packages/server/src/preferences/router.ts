import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

type PreferencesRow = {
  id: number;
  user_id: number;
  calendar: string;
  language: string;
  country: string | null;
  created_at: string;
  updated_at: string;
};

async function getOrCreatePreferences(userId: number): Promise<PreferencesRow> {
  const existing = (await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as PreferencesRow | undefined;

  if (existing) return existing;

  await db.execute({
    sql: 'INSERT INTO user_preferences (user_id, calendar, language, country) VALUES (?, ?, ?, ?)',
    args: [userId, 'miladi', 'en', null],
  });

  return (await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as PreferencesRow;
}

// GET /api/preferences
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const prefs = await getOrCreatePreferences(userId);
  res.json(prefs);
});

// PATCH /api/preferences
router.patch('/', async (req, res) => {
  const userId = req.user!.id;
  const { calendar, language, country } = req.body as { calendar?: string; language?: string; country?: string | null };

  if (calendar !== undefined && !['miladi', 'shamsi'].includes(calendar)) {
    res.status(400).json({ error: 'calendar must be "miladi" or "shamsi"' });
    return;
  }
  if (language !== undefined && !['en', 'fa'].includes(language)) {
    res.status(400).json({ error: 'language must be "en" or "fa"' });
    return;
  }
  if (country !== undefined && country !== null && !/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: 'country must be null or a 2-letter uppercase ISO country code' });
    return;
  }
  if (calendar === undefined && language === undefined && country === undefined) {
    res.status(400).json({ error: 'Provide at least one of: calendar, language, country' });
    return;
  }

  await getOrCreatePreferences(userId);

  if (calendar !== undefined) {
    await db.execute({
      sql: `UPDATE user_preferences SET calendar = ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [calendar, userId],
    });
  }
  if (language !== undefined) {
    await db.execute({
      sql: `UPDATE user_preferences SET language = ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [language, userId],
    });
  }
  if (country !== undefined) {
    await db.execute({
      sql: `UPDATE user_preferences SET country = ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [country, userId],
    });
  }

  const updated = (await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as PreferencesRow;

  res.json(updated);
});

export default router;
