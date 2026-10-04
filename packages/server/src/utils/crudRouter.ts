import { Router } from 'express';
import { InValue } from '@libsql/client';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { assertOwnership, buildPatch, fetchById } from './db';

export interface CrudConfig<TRow extends Record<string, unknown>> {
  /** DB table name */
  table: string;
  /** entity_type string used in document_attachments (e.g. 'reminder', 'date') */
  entityType: string;
  /** ORDER BY clause for GET, e.g. 'remind_at ASC' */
  orderBy?: string;
  /** Returns { sql, args } for the INSERT statement */
  insertSql: (userId: number, body: Record<string, unknown>) => { sql: string; args: InValue[] };
  /** Returns the partial update map for buildPatch */
  extractPatch: (body: Record<string, unknown>) => Record<string, InValue | undefined>;
  /** Return a non-null string to reject the create request with 400 */
  validateCreate?: (body: Record<string, unknown>) => string | null;
  /** Called after INSERT; row is the freshly inserted record. Errors are swallowed. */
  onAfterCreate?: (row: TRow, userId: number) => Promise<void>;
  /** Called after UPDATE with the updated record. Errors are swallowed. */
  onAfterUpdate?: (row: TRow, userId: number) => Promise<void>;
  /** Called before DELETE with the row that is about to be deleted. Errors are swallowed. */
  onBeforeDelete?: (row: TRow, userId: number) => Promise<void>;
  /** Optional transform applied to every outgoing row */
  transformRow?: (row: TRow) => Record<string, unknown>;
  /** 404 error message */
  notFoundMessage?: string;
}

export function createCrudRouter<TRow extends Record<string, unknown>>(
  cfg: CrudConfig<TRow>,
): Router {
  const router = Router();
  router.use(authenticateToken);

  const notFound = cfg.notFoundMessage ?? 'Not found';
  const transform = cfg.transformRow ?? ((r: TRow) => r as Record<string, unknown>);
  const orderBy = cfg.orderBy ?? 'id ASC';

  // GET /
  router.get('/', async (req, res) => {
    const userId = req.user!.id;
    const rows = (await db.execute({
      sql: `SELECT * FROM ${cfg.table} WHERE user_id = ? ORDER BY ${orderBy}`,
      args: [userId],
    })).rows as unknown as TRow[];
    res.json(rows.map(transform));
  });

  // POST /
  router.post('/', async (req, res) => {
    const userId = req.user!.id;
    const body = req.body as Record<string, unknown>;

    if (cfg.validateCreate) {
      const err = cfg.validateCreate(body);
      if (err) { res.status(400).json({ error: err }); return; }
    }

    const { sql, args } = cfg.insertSql(userId, body);
    const result = await db.execute({ sql, args });
    const row = await fetchById<TRow>(cfg.table, result.lastInsertRowid!);

    if (cfg.onAfterCreate) {
      try { await cfg.onAfterCreate(row!, userId); } catch { /* non-fatal */ }
    }

    res.status(201).json(transform(row!));
  });

  // PATCH /:id
  router.patch('/:id', async (req, res) => {
    const userId = req.user!.id;
    const id = Number(req.params.id);

    if (!await assertOwnership(cfg.table, id, userId)) {
      res.status(404).json({ error: notFound }); return;
    }

    const { fields, values } = buildPatch(cfg.extractPatch(req.body as Record<string, unknown>));
    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    values.push(id, userId);
    await db.execute({
      sql: `UPDATE ${cfg.table} SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      args: values,
    });

    const updated = await fetchById<TRow>(cfg.table, id);

    if (cfg.onAfterUpdate) {
      try { await cfg.onAfterUpdate(updated!, userId); } catch { /* non-fatal */ }
    }

    res.json(transform(updated!));
  });

  // DELETE /:id
  router.delete('/:id', async (req, res) => {
    const userId = req.user!.id;
    const id = Number(req.params.id);

    if (!await assertOwnership(cfg.table, id, userId)) {
      res.status(404).json({ error: notFound }); return;
    }

    const row = await fetchById<TRow>(cfg.table, id);

    if (cfg.onBeforeDelete) {
      try { await cfg.onBeforeDelete(row!, userId); } catch { /* non-fatal */ }
    }

    await db.execute({
      sql: 'DELETE FROM document_attachments WHERE entity_type = ? AND entity_id = ?',
      args: [cfg.entityType, id],
    });
    await db.execute({
      sql: `DELETE FROM ${cfg.table} WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    res.status(204).send();
  });

  return router;
}
