import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const router = Router();
const SALT_ROUNDS = 10;

function signToken(payload: { id: number; email: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign(payload, secret, { expiresIn: '30d' });
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
  })).rows[0] as unknown as { id: number; email: string; password_hash: string } | undefined;

  if (!row) {
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

export default router;
