import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

type PreferencesRow = {
  id: number;
  user_id: number;
  calendar: string;
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
    sql: 'INSERT INTO user_preferences (user_id, calendar) VALUES (?, ?)',
    args: [userId, 'miladi'],
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
  const { calendar } = req.body as { calendar?: string };

  if (!calendar || !['miladi', 'shamsi'].includes(calendar)) {
    res.status(400).json({ error: 'calendar must be "miladi" or "shamsi"' });
    return;
  }

  await getOrCreatePreferences(userId);

  await db.execute({
    sql: `UPDATE user_preferences SET calendar = ?, updated_at = datetime('now') WHERE user_id = ?`,
    args: [calendar, userId],
  });

  const updated = (await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as PreferencesRow;

  res.json(updated);
});

export default router;
