module.exports = (req, res) => {
  res.json({ ok: true, env: !!process.env.TURSO_DATABASE_URL });
};
