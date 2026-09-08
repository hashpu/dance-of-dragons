const bcrypt = require("bcrypt");
const { pool } = require("../db");

// Identifies who a request's x-admin-secret header belongs to: the site
// owner (matches ADMIN_SECRET exactly) or one of the named staff accounts
// the owner created (see routes/admin.js's /staff endpoints). Staff
// passwords are only ever stored as bcrypt hashes, same as house passwords,
// so this has to check each one in turn rather than a single lookup.
async function identifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  const provided = req.get("x-admin-secret");
  if (!secret || !provided) return null;
  if (provided === secret) return { role: "owner", name: "Owner" };

  const { rows } = await pool.query("SELECT id, name, password_hash FROM staff_accounts");
  for (const row of rows) {
    if (await bcrypt.compare(provided, row.password_hash)) {
      return { role: "staff", id: row.id, name: row.name };
    }
  }
  return null;
}

// Grants access to owner and staff alike — the day-to-day admin dashboard
// views (houses, applications) and non-destructive actions.
async function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_SECRET) {
    return res.status(500).json({ error: "ADMIN_SECRET is not configured on the server." });
  }
  const admin = await identifyAdmin(req);
  if (!admin) return res.status(401).json({ error: "Invalid admin secret." });
  req.admin = admin;
  next();
}

// Restricts to the site owner only — destructive actions (reset all data,
// delete a house) and staff-account management itself.
async function requireOwner(req, res, next) {
  if (!process.env.ADMIN_SECRET) {
    return res.status(500).json({ error: "ADMIN_SECRET is not configured on the server." });
  }
  const admin = await identifyAdmin(req);
  if (!admin || admin.role !== "owner") return res.status(401).json({ error: "Owner access required." });
  req.admin = admin;
  next();
}

module.exports = { requireAdmin, requireOwner, identifyAdmin };
