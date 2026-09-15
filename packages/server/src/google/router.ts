import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import {
  getAuthUrl,
  exchangeCode,
} from './drive.service';

const router = Router();

// GET /api/google/connect
// Accepts ?token= as an alternative to Authorization header (required for browser redirects)
router.get('/connect', (req, res) => {
  // Support token via query param since this is a full-page browser navigation
  const token = (req.query.token as string | undefined) ?? undefined;
  if (token) {
    req.headers['authorization'] = `Bearer ${token}`;
  }

  authenticateToken(req, res, async () => {
    const userId = req.user!.id;
    const state = Buffer.from(String(userId)).toString('base64');
    const userRow = (await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [userId] })).rows[0];
    const url = getAuthUrl(state, (userRow?.email as string | null) ?? undefined);
    res.redirect(url);
  });
});

// GET /api/google/callback
// Only exchanges the code and saves tokens — folder creation is deferred to first upload
router.get('/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  let userId: number;
  try {
    userId = Number(Buffer.from(state, 'base64').toString('utf8'));
    if (!userId || isNaN(userId)) throw new Error('invalid');
  } catch {
    res.status(400).json({ error: 'Invalid state' });
    return;
  }

  const tokens = await exchangeCode(code);

  // Save tokens — drive_folder_id resolved lazily on first upload
  await db.execute({
    sql: `INSERT INTO google_tokens (user_id, access_token, refresh_token, expiry, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            access_token  = excluded.access_token,
            refresh_token = COALESCE(excluded.refresh_token, refresh_token),
            expiry        = excluded.expiry,
            updated_at    = datetime('now')`,
    args: [userId, tokens.access_token, tokens.refresh_token, tokens.expiry],
  });

  // Redirect back to the client settings page
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  res.redirect(`${clientOrigin}/settings?drive=connected`);
});

// GET /api/google/status
router.get('/status', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  const row = (await db.execute({
    sql: 'SELECT id FROM google_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0];
  res.json({ connected: !!row });
});

// DELETE /api/google/disconnect
router.delete('/disconnect', authenticateToken, async (req, res) => {
  const userId = req.user!.id;
  await db.execute({
    sql: 'DELETE FROM google_tokens WHERE user_id = ?',
    args: [userId],
  });
  res.status(204).send();
});

export default router;
