import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads';

// Ensure uploads directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

// GET /api/documents
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const { tag } = req.query;

  let rows = db
    .prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC')
    .all(userId) as {
      id: number;
      user_id: number;
      title: string;
      filename: string;
      mimetype: string;
      size: number;
      tags: string;
      uploaded_at: string;
    }[];

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
router.post('/upload', upload.single('file'), (req, res) => {
  const userId = req.user!.id;

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

  const result = db
    .prepare(
      'INSERT INTO documents (user_id, title, filename, mimetype, size, tags) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      userId,
      title,
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      JSON.stringify(tagsArray)
    );

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(doc);
});

// GET /api/documents/:id/download
router.get('/:id/download', (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const doc = db
    .prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
    .get(id, userId) as { filename: string; title: string } | undefined;

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
router.delete('/:id', (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  const doc = db
    .prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
    .get(id, userId) as { filename: string } | undefined;

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(id, userId);

  const filePath = path.resolve(UPLOADS_DIR, doc.filename);
  fs.unlink(filePath, () => {}); // best-effort delete

  res.status(204).send();
});

export default router;
