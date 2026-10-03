import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

/** Maps entity_type values to the DB table that owns the entity. */
const ENTITY_TABLE: Record<string, string> = {
  task: 'tasks',
  date: 'important_dates',
  bill: 'bills',
  subscription: 'subscriptions',
  loan: 'loans',
  habit: 'habits',
  reminder: 'reminders',
};

/** Returns true if the given entity belongs to the user. */
async function ownsEntity(entityType: string, entityId: number, userId: number): Promise<boolean> {
  const table = ENTITY_TABLE[entityType];
  if (!table) return false;
  const row = (await db.execute({
    sql: `SELECT id FROM ${table} WHERE id = ? AND user_id = ?`,
    args: [entityId, userId],
  })).rows[0];
  return !!row;
}

// GET /api/attachments?entity_type=X&entity_id=N
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const { entity_type, entity_id } = req.query as { entity_type?: string; entity_id?: string };

  if (!entity_type || !entity_id || isNaN(Number(entity_id))) {
    res.status(400).json({ error: 'entity_type and entity_id are required' });
    return;
  }

  if (!ENTITY_TABLE[entity_type]) {
    res.status(400).json({ error: 'Invalid entity_type' });
    return;
  }

  const entityId = Number(entity_id);

  if (!await ownsEntity(entity_type, entityId, userId)) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  const rows = (await db.execute({
    sql: `SELECT d.id, d.title, d.filename, d.mimetype, d.drive_file_id, d.drive_view_link
          FROM document_attachments da
          JOIN documents d ON d.id = da.document_id
          WHERE da.entity_type = ? AND da.entity_id = ?`,
    args: [entity_type, entityId],
  })).rows;

  res.json(rows);
});

// POST /api/attachments
router.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { entity_type, entity_id, document_id } = req.body as {
    entity_type?: string;
    entity_id?: number;
    document_id?: number;
  };

  if (!entity_type || entity_id == null || document_id == null) {
    res.status(400).json({ error: 'entity_type, entity_id, and document_id are required' });
    return;
  }

  if (!ENTITY_TABLE[entity_type]) {
    res.status(400).json({ error: 'Invalid entity_type' });
    return;
  }

  if (!await ownsEntity(entity_type, entity_id, userId)) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  // Verify document belongs to this user
  const docRow = (await db.execute({
    sql: 'SELECT id FROM documents WHERE id = ? AND user_id = ?',
    args: [document_id, userId],
  })).rows[0];
  if (!docRow) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  await db.execute({
    sql: 'INSERT OR IGNORE INTO document_attachments (document_id, entity_type, entity_id) VALUES (?, ?, ?)',
    args: [document_id, entity_type, entity_id],
  });

  res.status(201).json({ ok: true });
});

// DELETE /api/attachments
router.delete('/', async (req, res) => {
  const userId = req.user!.id;
  const { entity_type, entity_id, document_id } = req.body as {
    entity_type?: string;
    entity_id?: number;
    document_id?: number;
  };

  if (!entity_type || entity_id == null || document_id == null) {
    res.status(400).json({ error: 'entity_type, entity_id, and document_id are required' });
    return;
  }

  if (!ENTITY_TABLE[entity_type]) {
    res.status(400).json({ error: 'Invalid entity_type' });
    return;
  }

  if (!await ownsEntity(entity_type, entity_id, userId)) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  await db.execute({
    sql: 'DELETE FROM document_attachments WHERE entity_type = ? AND entity_id = ? AND document_id = ?',
    args: [entity_type, entity_id, document_id],
  });

  res.status(204).send();
});

export default router;
