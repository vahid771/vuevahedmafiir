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
  secondary_calendar: string | null;
  tertiary_calendar: string | null;
  timezone: string | null;
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
    sql: 'INSERT INTO user_preferences (user_id, calendar, language, country, secondary_calendar, tertiary_calendar) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, 'miladi', 'en', null, null, null],
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
  const { calendar, language, country, secondary_calendar, tertiary_calendar, timezone } = req.body as {
    calendar?: string; language?: string; country?: string | null;
    secondary_calendar?: string | null; tertiary_calendar?: string | null;
    timezone?: string | null;
  };

  const VALID_CALS = ['miladi', 'shamsi', 'qamari', 'hebrew', 'chinese', 'saka', 'ethiopian'];
  if (calendar !== undefined && !VALID_CALS.includes(calendar)) {
    res.status(400).json({ error: 'calendar must be a valid calendar type' });
    return;
  }
  if (language !== undefined && !['en', 'fa', 'ar', 'zh', 'hi', 'es', 'fr', 'de', 'pt', 'ru', 'tr', 'id'].includes(language)) {
    res.status(400).json({ error: 'language must be a valid language code' });
    return;
  }
  if (country !== undefined && country !== null && !/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: 'country must be null or a 2-letter uppercase ISO country code' });
    return;
  }
  if (secondary_calendar !== undefined && secondary_calendar !== null && !VALID_CALS.includes(secondary_calendar)) {
    res.status(400).json({ error: 'secondary_calendar must be null or a valid calendar type' });
    return;
  }
  if (tertiary_calendar !== undefined && tertiary_calendar !== null && !VALID_CALS.includes(tertiary_calendar)) {
    res.status(400).json({ error: 'tertiary_calendar must be null or a valid calendar type' });
    return;
  }
  if (timezone !== undefined && timezone !== null && typeof timezone !== 'string') {
    res.status(400).json({ error: 'timezone must be null or an IANA timezone string' });
    return;
  }
  if (calendar === undefined && language === undefined && country === undefined &&
      secondary_calendar === undefined && tertiary_calendar === undefined && timezone === undefined) {
    res.status(400).json({ error: 'Provide at least one field to update' });
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
  if (secondary_calendar !== undefined) {
    await db.execute({
      sql: `UPDATE user_preferences SET secondary_calendar = ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [secondary_calendar, userId],
    });
  }
  if (tertiary_calendar !== undefined) {
    await db.execute({
      sql: `UPDATE user_preferences SET tertiary_calendar = ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [tertiary_calendar, userId],
    });
  }
  if (timezone !== undefined) {
    await db.execute({
      sql: `UPDATE user_preferences SET timezone = ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [timezone, userId],
    });
  }

  const updated = (await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as PreferencesRow;

  res.json(updated);
});

export default router;
