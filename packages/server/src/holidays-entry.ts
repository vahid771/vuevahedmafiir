import express from 'express';
import holidaysRouter from './holidays/router';
import { runMigrations } from './db';

const app = express();

// Run migrations on cold start so holidays_seed (and all other tables) exist
// even when this Vercel function bundle boots independently of the main bundle.
runMigrations().catch(e => console.error('[holidays-entry] migration error:', e));

app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (req.body !== undefined) return next();
  if (!(req as any).readable) {
    if (ct.includes('application/json') && req.body === undefined) req.body = {};
    return next();
  }
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    if (ct.includes('application/json') && raw.length > 0) {
      try { req.body = JSON.parse(raw.toString('utf8')); } catch { req.body = {}; }
    }
    next();
  });
  req.on('error', () => next());
});

app.use('/api/holidays', holidaysRouter);

export default app;
