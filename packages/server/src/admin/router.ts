import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateToken);

// GET /api/admin/me — returns { isAdmin: true/false } for the current user.
// No requireAdmin here so regular users can check their status.
router.get('/me', async (req, res) => {
  const userId = req.user!.id;
  const row = (await db.execute({
    sql: 'SELECT is_admin FROM users WHERE id = ?',
    args: [userId],
  })).rows[0] as unknown as { is_admin: number } | undefined;

  res.json({ isAdmin: row?.is_admin === 1 });
});

// All routes below this point require admin
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/images
// Returns all document records whose mimetype starts with "image/", across all
// users, ordered by upload date descending.
// ---------------------------------------------------------------------------
router.get('/images', async (_req, res) => {
  const rows = (await db.execute({
    sql: `SELECT d.id, d.user_id, u.email AS user_email,
                 d.title, d.filename, d.mimetype, d.size,
                 d.tags, d.drive_file_id, d.drive_view_link,
                 d.uploaded_at,
                 COALESCE(ai.status, 'pending') AS status,
                 ai.review_note, ai.reviewed_at, ai.reviewed_by
          FROM documents d
          JOIN users u ON u.id = d.user_id
          LEFT JOIN admin_image_reviews ai ON ai.document_id = d.id
          WHERE d.mimetype LIKE 'image/%'
          ORDER BY d.uploaded_at DESC`,
    args: [],
  })).rows;

  res.json(rows);
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/images/:id
// Body: { status: 'approved' | 'rejected' | 'pending', note?: string }
// ---------------------------------------------------------------------------
router.patch('/images/:id', async (req, res) => {
  const docId = Number(req.params.id);
  const adminId = req.user!.id;
  const { status, note } = req.body as { status?: string; note?: string };

  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    res.status(400).json({ error: 'status must be approved, rejected, or pending' });
    return;
  }

  // Verify document exists
  const doc = (await db.execute({
    sql: 'SELECT id FROM documents WHERE id = ?',
    args: [docId],
  })).rows[0];
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  // Upsert review record
  await db.execute({
    sql: `INSERT INTO admin_image_reviews (document_id, status, review_note, reviewed_at, reviewed_by)
          VALUES (?, ?, ?, datetime('now'), ?)
          ON CONFLICT(document_id) DO UPDATE SET
            status      = excluded.status,
            review_note = excluded.review_note,
            reviewed_at = excluded.reviewed_at,
            reviewed_by = excluded.reviewed_by`,
    args: [docId, status, note ?? null, adminId],
  });

  const updated = (await db.execute({
    sql: `SELECT d.id, d.user_id, u.email AS user_email,
                 d.title, d.filename, d.mimetype, d.size,
                 d.tags, d.drive_file_id, d.drive_view_link, d.uploaded_at,
                 ai.status, ai.review_note, ai.reviewed_at, ai.reviewed_by
          FROM documents d
          JOIN users u ON u.id = d.user_id
          LEFT JOIN admin_image_reviews ai ON ai.document_id = d.id
          WHERE d.id = ?`,
    args: [docId],
  })).rows[0];

  res.json(updated);
});

// ---------------------------------------------------------------------------
// GET /api/admin/users — list all users with admin flag
// ---------------------------------------------------------------------------
router.get('/users', async (_req, res) => {
  const rows = (await db.execute({
    sql: `SELECT id, email, is_admin, created_at FROM users ORDER BY created_at DESC`,
    args: [],
  })).rows;
  res.json(rows);
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id — toggle admin flag
// Body: { is_admin: 0 | 1 }
// ---------------------------------------------------------------------------
router.patch('/users/:id', async (req, res) => {
  const targetId = Number(req.params.id);
  const requesterId = req.user!.id;
  const { is_admin } = req.body as { is_admin?: number };

  // Prevent self-demotion
  if (targetId === requesterId) {
    res.status(400).json({ error: 'Cannot change your own admin status' });
    return;
  }

  if (is_admin === undefined || (is_admin !== 0 && is_admin !== 1)) {
    res.status(400).json({ error: 'is_admin must be 0 or 1' });
    return;
  }

  await db.execute({
    sql: 'UPDATE users SET is_admin = ? WHERE id = ?',
    args: [is_admin, targetId],
  });

  res.json({ ok: true });
});

export default router;
