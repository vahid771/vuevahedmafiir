let loadErr = null;
let app = null;

try {
  app = require('./_google/app').default;
} catch (e) {
  loadErr = e;
}

function handler(req, res) {
  if (loadErr) {
    return res.status(500).json({ stage: 'load', error: String(loadErr), stack: loadErr?.stack });
  }
  return app(req, res);
}

// Disable Vercel's built-in body parser so multipart/form-data uploads
// reach the handler as a raw stream that busboy can consume.
handler.config = { api: { bodyParser: false } };

module.exports = handler;
