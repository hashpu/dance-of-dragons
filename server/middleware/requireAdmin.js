function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "ADMIN_SECRET is not configured on the server." });
  }
  if (req.get("x-admin-secret") !== secret) {
    return res.status(401).json({ error: "Invalid admin secret." });
  }
  next();
}

module.exports = { requireAdmin };
