let loadErr = null;
let app = null;
let runMigrations = null;

try {
  app = require('./app').default;
  runMigrations = require('./db').runMigrations;
} catch (e) {
  loadErr = e;
}

let migrated = false;

async function handler(req, res) {
  if (loadErr) {
    return res.status(500).json({ stage: 'load', error: String(loadErr), stack: loadErr.stack });
  }
  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (migErr) {
      return res.status(500).json({ stage: 'migrate', error: String(migErr) });
    }
  }

  // Vercel's Rust runtime defines req.body as a lazy getter that parses the body as JSON.
  // For multipart/form-data requests this throws "Invalid JSON".
  // We intercept here — before Express runs — and replace the getter with a plain Buffer
  // so busboy can pipe req directly without ever triggering the getter.
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) {
    // Collect the raw bytes that Vercel would have parsed, by reading the stream directly.
    // We replace the throwing getter with undefined so Express/body-parser never fires.
    try {
      // Attempt to read raw bytes — on Vercel the stream is still readable at this point
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', resolve);
        req.on('error', reject);
      });
      const rawBody = Buffer.concat(chunks);
      // Replace the getter with a readable stream shim so busboy can consume it
      const { Readable } = require('stream');
      const stream = Readable.from(rawBody);
      // Copy stream methods onto req so busboy's req.pipe(bb) works
      req.pipe = stream.pipe.bind(stream);
      req[Symbol.asyncIterator] = stream[Symbol.asyncIterator].bind(stream);
    } catch (_) {
      // If stream reading fails, let it fall through — busboy will handle the error
    }
    // Shadow the getter so express.json() won't throw
    Object.defineProperty(req, 'body', { configurable: true, writable: true, value: undefined });
  }

  return app(req, res);
}

module.exports = handler;
