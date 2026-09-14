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

  // Vercel pre-reads the entire body before our code runs.
  // For multipart/form-data, store the raw buffer on req._rawBody
  // so our busboy parser can use it, then shadow the getter so express.json() never fires.
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) {
    let rawBody = null;

    // Try to grab whatever Vercel put in the body descriptor
    const bodyDescriptor = Object.getOwnPropertyDescriptor(req, 'body')
      || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(req), 'body');

    if (bodyDescriptor && bodyDescriptor.get) {
      // It's a getter — call it in a try/catch to get the raw value
      try {
        rawBody = bodyDescriptor.get.call(req);
      } catch (_) {
        // getter threw — body bytes are already in the underlying socket buffer
        // We'll collect them below by reading the stream
      }
    } else if (bodyDescriptor && bodyDescriptor.value !== undefined) {
      rawBody = bodyDescriptor.value;
    }

    // If we still don't have the bytes, drain the stream
    if (rawBody === null || rawBody === undefined) {
      rawBody = await new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', () => resolve(Buffer.alloc(0)));
      });
    }

    // Ensure it's a Buffer
    if (typeof rawBody === 'string') rawBody = Buffer.from(rawBody);
    else if (!(rawBody instanceof Buffer)) rawBody = Buffer.from(rawBody || '');

    // Store it for busboy, then shadow the getter with undefined
    req._rawBody = rawBody;
    Object.defineProperty(req, 'body', { configurable: true, writable: true, value: undefined });
  }

  return app(req, res);
}

module.exports = handler;
