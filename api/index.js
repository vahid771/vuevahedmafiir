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

// Disable Vercel's automatic body parsing so multer can read the raw stream
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
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
  return app(req, res);
};
