let loadErr = null;
let app = null;

try {
  app = require('./_core/app').default;
  const { runMigrations } = require('./_core/db');
  runMigrations().catch(e => console.error('[migration] background error:', e));
} catch (e) {
  loadErr = e;
}

function handler(req, res) {
  if (loadErr) {
    return res.status(500).json({ stage: 'load', error: String(loadErr), stack: loadErr?.stack });
  }
  return app(req, res);
}

module.exports = handler;
