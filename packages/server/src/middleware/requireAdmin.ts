import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

/**
 * Express middleware that allows the request only if the authenticated user
 * has `is_admin = 1` in the `users` table.
 *
 * Must be used AFTER `authenticateToken` (which sets req.user).
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const row = (await db.execute({
    sql: 'SELECT is_admin FROM users WHERE id = ?',
    args: [userId],
  })).rows[0] as unknown as { is_admin: number } | undefined;

  if (!row || !row.is_admin) {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return;
  }

  next();
}
