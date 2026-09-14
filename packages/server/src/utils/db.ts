import { InValue } from '@libsql/client';
import { db } from '../db';

/**
 * Returns true if a row with the given id and user_id exists in table, false otherwise.
 * Callers are responsible for sending the 404 response when false is returned.
 */
export async function assertOwnership(table: string, id: number, userId: number): Promise<boolean> {
  const row = (await db.execute({
    sql: `SELECT id FROM ${table} WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  })).rows[0];
  return row !== undefined;
}

/**
 * Returns the first row from table matching the given id, cast to T, or undefined if not found.
 */
export async function fetchById<T>(table: string, id: number | bigint): Promise<T | undefined> {
  const row = (await db.execute({
    sql: `SELECT * FROM ${table} WHERE id = ?`,
    args: [id],
  })).rows[0];
  return row as unknown as T | undefined;
}

/**
 * Builds the SET clause fields and values for a PATCH update, skipping any
 * entry whose value is undefined.
 *
 * @example
 * const { fields, values } = buildPatch({ title, description, due_date: due_date ?? null });
 * if (fields.length === 0) { res.status(400)...; return; }
 * values.push(id, userId);
 * await db.execute({ sql: `UPDATE t SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, args: values });
 */
export function buildPatch(
  updates: Record<string, InValue | undefined>,
): { fields: string[]; values: InValue[] } {
  const fields: string[] = [];
  const values: InValue[] = [];
  for (const [col, val] of Object.entries(updates)) {
    if (val === undefined) continue;
    fields.push(`${col} = ?`);
    values.push(val);
  }
  return { fields, values };
}
