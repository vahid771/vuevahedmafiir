/**
 * Utilities for encoding/decoding local file attachments inside Google Task notes.
 *
 * Google Tasks API does not allow writing to the read-only `links` field, so we
 * embed attachment metadata as a structured block at the end of the task's `notes`
 * field using an unambiguous separator:
 *
 *   <user description>
 *
 *   ── Attachments ──
 *   My file.pdf | https://drive.google.com/...
 *   Photo.jpg | https://drive.google.com/...
 *
 * Functions here:
 *  - encodeAttachmentsIntoNotes  — append block to notes string before pushing to Google
 *  - decodeAttachmentsFromNotes  — strip block from notes, return { description, attachments }
 *  - syncInboundAttachments      — reconcile parsed attachment lines into local DB records
 */

import { db } from '../db';

const ATTACHMENT_SEPARATOR = '\n\n── Attachments ──';
const ATTACHMENT_LINE_RE = /^(.+?) \| (https?:\/\/.+)$/;

export interface ParsedAttachment {
  title: string;
  link: string;
}

/**
 * Appends a structured attachment block to `notes`.
 * If `attachments` is empty, returns `notes` unchanged.
 */
export function encodeAttachmentsIntoNotes(
  notes: string | undefined,
  attachments: ParsedAttachment[],
): string | undefined {
  if (attachments.length === 0) return notes;
  // Strip any existing block first to avoid duplication on repeated updates
  const baseNotes = stripAttachmentBlock(notes ?? '');
  const lines = attachments.map(a => `${a.title} | ${a.link}`).join('\n');
  return `${baseNotes}${ATTACHMENT_SEPARATOR}\n${lines}`;
}

/**
 * Strips the attachment block from `notes` and returns the clean description
 * plus any parsed attachment lines.
 */
export function decodeAttachmentsFromNotes(notes: string | undefined): {
  description: string | undefined;
  attachments: ParsedAttachment[];
} {
  if (!notes) return { description: undefined, attachments: [] };

  const sepIdx = notes.indexOf(ATTACHMENT_SEPARATOR);
  if (sepIdx === -1) return { description: notes || undefined, attachments: [] };

  const description = notes.slice(0, sepIdx).trimEnd() || undefined;
  const block = notes.slice(sepIdx + ATTACHMENT_SEPARATOR.length).trimStart();
  const attachments: ParsedAttachment[] = [];
  for (const line of block.split('\n')) {
    const match = line.trim().match(ATTACHMENT_LINE_RE);
    if (match) attachments.push({ title: match[1].trim(), link: match[2].trim() });
  }
  return { description, attachments };
}

function stripAttachmentBlock(notes: string): string {
  const sepIdx = notes.indexOf(ATTACHMENT_SEPARATOR);
  return sepIdx === -1 ? notes : notes.slice(0, sepIdx).trimEnd();
}

/**
 * Given a list of attachment lines parsed from Google Task notes (or Google's native
 * `links` field), reconcile them into the local DB for the given task.
 *
 * For each link:
 *  1. If a `documents` row already exists with that `drive_view_link`, reuse it.
 *  2. Otherwise create a minimal document stub (no actual file upload).
 *  3. Create a `document_attachments` record if not already present.
 *
 * This is non-fatal — any error per-attachment is silently ignored.
 */
export async function syncInboundAttachments(
  userId: number,
  taskId: number,
  attachments: ParsedAttachment[],
): Promise<void> {
  for (const att of attachments) {
    try {
      // 1. Look up existing document by drive_view_link
      let docId: number | null = null;
      const existing = (await db.execute({
        sql: 'SELECT id FROM documents WHERE user_id = ? AND drive_view_link = ?',
        args: [userId, att.link],
      })).rows[0];

      if (existing) {
        docId = existing.id as number;
      } else {
        // 2. Create a minimal stub — filename derived from title
        const safeName = att.title.replace(/[^\w\s.-]/g, '').trim() || 'attachment';
        const result = await db.execute({
          sql: `INSERT INTO documents (user_id, title, filename, mimetype, size, drive_view_link)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [userId, att.title, safeName, 'application/octet-stream', 0, att.link],
        });
        docId = Number(result.lastInsertRowid!);
      }

      // 3. Attach to task (INSERT OR IGNORE handles duplicates)
      await db.execute({
        sql: 'INSERT OR IGNORE INTO document_attachments (document_id, entity_type, entity_id) VALUES (?, ?, ?)',
        args: [docId, 'task', taskId],
      });
    } catch { /* non-fatal per attachment */ }
  }
}

/**
 * Fetches all drive-linked attachments for a local task and returns them as
 * ParsedAttachment[] ready to be encoded into Google Task notes.
 *
 * Only includes attachments that have a `drive_view_link` (i.e. are in Google Drive).
 */
export async function getTaskAttachmentsForSync(
  taskId: number,
): Promise<ParsedAttachment[]> {
  const rows = (await db.execute({
    sql: `SELECT d.title, d.drive_view_link
          FROM document_attachments da
          JOIN documents d ON d.id = da.document_id
          WHERE da.entity_type = 'task' AND da.entity_id = ? AND d.drive_view_link IS NOT NULL`,
    args: [taskId],
  })).rows as unknown as { title: string; drive_view_link: string }[];

  return rows.map(r => ({ title: r.title, link: r.drive_view_link }));
}
