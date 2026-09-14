import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/tmp/uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
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
  uploaded_at: string;
};

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
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  if (!req.file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }

  const { title, tags } = req.body as { title?: string; tags?: string };

  if (!title) {
    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: 'title is required' });
    return;
  }

  // Parse tags: accept comma-separated string or JSON array string
  let tagsArray: string[] = [];
  if (tags) {
    try {
      tagsArray = JSON.parse(tags);
    } catch {
      tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    }
  }

  const result = await db.execute({
    sql: 'INSERT INTO documents (user_id, title, filename, mimetype, size, tags) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, title, req.file.filename, req.file.mimetype, req.file.size, JSON.stringify(tagsArray)],
  });

  const doc = (await db.execute({ sql: 'SELECT * FROM documents WHERE id = ?', args: [result.lastInsertRowid!] })).rows[0];
  res.status(201).json(doc);
});

// GET /api/documents/:id/download
router.get('/:id/download', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const doc = (await db.execute({
    sql: 'SELECT * FROM documents WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0] as unknown as { filename: string; title: string } | undefined;

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const filePath = path.resolve(UPLOADS_DIR, doc.filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on disk' });
    return;
  }

  res.download(filePath, doc.title);
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const doc = (await db.execute({
    sql: 'SELECT * FROM documents WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })).rows[0] as unknown as { filename: string } | undefined;

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  await db.execute({ sql: 'DELETE FROM documents WHERE id = ? AND user_id = ?', args: [id, userId] });

  const filePath = path.resolve(UPLOADS_DIR, doc.filename);
  fs.unlink(filePath, () => {}); // best-effort delete

  res.status(204).send();
});

export default router;
