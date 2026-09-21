import express from 'express';
import aiRouter from './ai/router';

const app = express();

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

app.use('/api/ai', aiRouter);

export default app;
