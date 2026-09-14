import { Router, Request } from 'express';
import { Readable } from 'stream';
import Busboy from 'busboy';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { fetchById } from '../utils/db';
import { getAuthedClient, uploadFile, downloadFile, deleteFile, getOrCreateFolder } from '../google/drive.service';

// Parse multipart/form-data manually using busboy so it works on Vercel
// (Vercel's runtime pre-reads the body; multer's stream approach fails in that env)
function parseMultipart(req: Request): Promise<{ file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | null; fields: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    let file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | null = null;

    const bb = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });

    bb.on('file', (fieldname, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        file = { buffer, originalname: info.filename, mimetype: info.mimeType, size: buffer.length };
      });
    });

    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('finish', () => resolve({ file, fields }));
    bb.on('error', reject);

    // Vercel pre-reads the body into req.body (or _rawBody after our middleware clears it)
    const raw = (req as any)._rawBody ?? req.body;
    if (Buffer.isBuffer(raw)) {
      Readable.from(raw).pipe(bb);
    } else if (raw instanceof Uint8Array) {
      Readable.from(Buffer.from(raw)).pipe(bb);
    } else {
      // Body not pre-read — pipe the raw request stream
      req.pipe(bb);
    }
  });
}

const router = Router();
router.use(authenticateToken);

type DocumentRow = {
  id: number;
  user_id: number;
  title: string;
  filename: string;
  mimetype: string;
  size: number;
  tags: string;
  drive_file_id: string | null;
  drive_view_link: string | null;
  uploaded_at: string;
};

type GoogleTokenRow = {
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
  drive_folder_id: string;
};

const DRIVE_FOLDER_NAME = 'Personal Life Dashboard';

async function getDriveAuth(userId: number) {
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry, drive_folder_id FROM google_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as GoogleTokenRow | undefined;

  if (!row) return null;

  const auth = getAuthedClient(row);

  // Lazily resolve folder ID on first use after connect
  let folderId = row.drive_folder_id;
  if (!folderId) {
    folderId = await getOrCreateFolder(auth, DRIVE_FOLDER_NAME);
    await db.execute({
      sql: `UPDATE google_tokens SET drive_folder_id = ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [folderId, userId],
    });
  }

  return { auth, folderId };
}

// GET /api/documents
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const { tag } = req.query;

  let rows = (await db.execute({
    sql: 'SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC',
    args: [userId],
  })).rows as unknown as DocumentRow[];

  if (tag && typeof tag === 'string') {
    rows = rows.filter(r => {
      try {
        const tags: string[] = JSON.parse(r.tags);
        return tags.includes(tag);
      } catch {
        return false;
      }
    });
  }

  res.json(rows);
});

// POST /api/documents/upload
router.post('/upload', async (req, res) => {
  const userId = req.user!.id;

  const { file, fields } = await parseMultipart(req);

  if (!file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }

  const title = fields['title'];
  const tags = fields['tags'];

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const drive = await getDriveAuth(userId);
  if (!drive) {
    res.status(403).json({ error: 'Google Drive not connected. Please connect from Settings.' });
    return;
  }

  let tagsArray: string[] = [];
  if (tags) {
    try {
      tagsArray = JSON.parse(tags);
    } catch {
      tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    }
  }

  const { driveFileId, driveViewLink } = await uploadFile(
    drive.auth,
    drive.folderId,
    file.originalname,
    file.mimetype,
    file.buffer,
  );

  const result = await db.execute({
    sql: 'INSERT INTO documents (user_id, title, filename, mimetype, size, tags, drive_file_id, drive_view_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      userId,
      title,
      file.originalname,
      file.mimetype,
      file.size,
      JSON.stringify(tagsArray),
      driveFileId,
      driveViewLink,
    ],
  });

  const doc = await fetchById<object>('documents', result.lastInsertRowid!);
  res.status(201).json(doc);
});

// GET /api/documents/:id/download
router.get('/:id/download', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const doc = (await db.execute({
    sql: 'SELECT * FROM documents WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0] as unknown as DocumentRow | undefined;

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (!doc.drive_file_id) {
    res.status(404).json({ error: 'File has no Drive reference' });
    return;
  }

  const drive = await getDriveAuth(userId);
  if (!drive) {
    res.status(403).json({ error: 'Google Drive not connected' });
    return;
  }

  const stream = await downloadFile(drive.auth, doc.drive_file_id);

  res.setHeader('Content-Disposition', `attachment; filename="${doc.title}"`);
  if (doc.mimetype) res.setHeader('Content-Type', doc.mimetype);
  stream.pipe(res);
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const doc = (await db.execute({
    sql: 'SELECT * FROM documents WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0] as unknown as DocumentRow | undefined;

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  // Delete from Drive if we have a file ID and Drive is connected
  if (doc.drive_file_id) {
    const drive = await getDriveAuth(userId);
    if (drive) {
      try {
        await deleteFile(drive.auth, doc.drive_file_id);
      } catch {
        // Non-fatal: proceed with DB delete even if Drive delete fails
      }
    }
  }

  await db.execute({ sql: 'DELETE FROM documents WHERE id = ? AND user_id = ?', args: [id, userId] });
  res.status(204).send();
});

export default router;
