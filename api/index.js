let loadErr = null;
let app = null;
let migrationPromise = null;

try {
  app = require('./app').default;
  const { runMigrations } = require('./db');
  // Start migrations immediately at module load time so the cost is not
  // charged against the first incoming request's timeout budget.
  migrationPromise = runMigrations();
} catch (e) {
  loadErr = e;
}

async function handler(req, res) {
  if (loadErr) {
    return res.status(500).json({ stage: 'load', error: String(loadErr), stack: loadErr.stack });
  }
  try {
    await migrationPromise;
  } catch (migErr) {
    return res.status(500).json({ stage: 'migrate', error: String(migErr) });
  }
  return app(req, res);
}

module.exports = handler;
