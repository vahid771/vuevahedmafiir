import { Router } from 'express';
import multer from 'multer';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';
import { fetchById } from '../utils/db';
import { getAuthedClient, uploadFile, downloadFile, deleteFile } from '../google/drive.service';

// Memory storage only — no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

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

async function getDriveAuth(userId: number) {
  const row = (await db.execute({
    sql: 'SELECT access_token, refresh_token, expiry, drive_folder_id FROM google_tokens WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as GoogleTokenRow | undefined;

  if (!row) return null;
  return { auth: getAuthedClient(row), folderId: row.drive_folder_id };
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
router.post('/upload', upload.single('file'), async (req, res) => {
  const userId = req.user!.id;

  if (!req.file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }

  const { title, tags } = req.body as { title?: string; tags?: string };

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
    req.file.originalname,
    req.file.mimetype,
    req.file.buffer,
  );

  const result = await db.execute({
    sql: 'INSERT INTO documents (user_id, title, filename, mimetype, size, tags, drive_file_id, drive_view_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      userId,
      title,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
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
