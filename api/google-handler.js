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

module.exports = handler;
