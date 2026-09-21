let loadErr = null;
let app = null;

try {
  app = require('./_ai/app').default;
} catch (e) {
  loadErr = e;
}

module.exports = function handler(req, res) {
  if (loadErr) {
    console.error('[ai-handler] load error:', String(loadErr));
    return res.status(500).json({ error: String(loadErr), stage: 'load' });
  }
  if (!app) {
    return res.status(500).json({ error: 'app not initialized', stage: 'load' });
  }
  return app(req, res);
};
