import express from 'express';
import aiRouter from './ai/router';

const app = express();

// Body parser: drain the raw stream and parse JSON.
// Vercel's bundling runtime passes the raw IncomingMessage without pre-parsing.
// Guard: if the body was already set (legacy path), skip draining.
app.use((req, res, next) => {
  // Already parsed (e.g. legacy Vercel runtime or test environment)
  if (req.body !== undefined) return next();

  const ct = req.headers['content-type'] || '';
  const isJson = ct.includes('application/json');

  const chunks: Buffer[] = [];
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    const raw = Buffer.concat(chunks);
    if (isJson && raw.length > 0) {
      try { req.body = JSON.parse(raw.toString('utf8')); } catch { req.body = {}; }
    } else if (req.body === undefined) {
      req.body = {};
    }
    next();
  }

  // Safety timeout: if the stream never ends in 3s, proceed with empty body
  const timer = setTimeout(finish, 3000);

  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => { clearTimeout(timer); finish(); });
  req.on('close', () => { clearTimeout(timer); finish(); });
  req.on('error', () => { clearTimeout(timer); finish(); });
});

app.get('/api/ai/_health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), env: { groq: !!process.env.GROQ_API_KEY, turso: !!process.env.TURSO_DATABASE_URL, jwt: !!process.env.JWT_SECRET } });
});

app.use('/api/ai', aiRouter);

export default app;
