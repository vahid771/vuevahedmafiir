import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { db } from '../db';

const router = Router();
const SALT_ROUNDS = 10;

function signToken(payload: { id: number; email: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}

function getGoogleLoginClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not set');
  if (!redirectUri) throw new Error('GOOGLE_LOGIN_REDIRECT_URI is not set');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })).rows[0];
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await db.execute({
    sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    args: [email, password_hash],
  });

  const user = { id: Number(result.lastInsertRowid!), email };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const row = (await db.execute({
    sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
    args: [email],
  })).rows[0] as unknown as { id: number; email: string; password_hash: string | null } | undefined;

  if (!row || !row.password_hash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const user = { id: Number(row.id), email: row.email };
  const token = signToken(user);
  res.json({ token, user });
});

// GET /api/auth/google
// Redirects browser to Google's OAuth consent screen
router.get('/google', (_req, res) => {
  const client = getGoogleLoginClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
  });
  res.redirect(url);
});

// GET /api/auth/google/callback
// Exchanges code, upserts user, issues JWT, redirects to client
router.get('/google/callback', async (req, res) => {
  const { code } = req.query as { code?: string };
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

  if (!code) {
    res.redirect(`${clientOrigin}/login?error=google_failed`);
    return;
  }

  try {
    const client = getGoogleLoginClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();

    const email = data.email;
    if (!email) {
      res.redirect(`${clientOrigin}/login?error=no_email`);
      return;
    }

    // Upsert user — Google-authed users have no password_hash
    let row = (await db.execute({
      sql: 'SELECT id, email FROM users WHERE email = ?',
      args: [email],
    })).rows[0] as unknown as { id: number; email: string } | undefined;

    if (!row) {
      const result = await db.execute({
        sql: 'INSERT INTO users (email, password_hash) VALUES (?, NULL)',
        args: [email],
      });
      row = { id: Number(result.lastInsertRowid!), email };
    }

    const user = { id: Number(row.id), email: row.email };
    const token = signToken(user);

    const encodedUser = Buffer.from(JSON.stringify(user)).toString('base64');
    res.redirect(`${clientOrigin}/auth/callback?token=${encodeURIComponent(token)}&user=${encodedUser}`);
  } catch (err) {
    console.error('Google login error:', err);
    res.redirect(`${clientOrigin}/login?error=google_failed`);
  }
});

export default router;
