const bcrypt = require("bcrypt");
const { pool } = require("../db");
const { getRequestOwnerDiscordUser, getRequestDiscordUserId } = require("../discord");

// Identifies who's making this request: the site owner (matches
// ADMIN_SECRET exactly, OR is signed in with Discord as one of the accounts
// listed in OWNER_DISCORD_USER_IDS — no secret needed at all for those), or
// one of the staff accounts the owner added (see routes/admin.js's /staff
// endpoints) — normally by Discord ID (just being signed in as that account
// is enough), with an old password-based path kept around for any account
// created before that existed.
async function identifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  const provided = req.get("x-admin-secret");

  if (secret && provided && provided === secret) return { role: "owner", name: "Owner" };

  const ownerDiscordUser = await getRequestOwnerDiscordUser(req);
  if (ownerDiscordUser) return { role: "owner", name: ownerDiscordUser.username };

  const discordUserId = await getRequestDiscordUserId(req);
  if (discordUserId) {
    const { rows } = await pool.query(
      "SELECT id, name FROM staff_accounts WHERE discord_user_id = $1",
      [discordUserId]
    );
    if (rows[0]) return { role: "staff", id: rows[0].id, name: rows[0].name };
  }

  if (provided) {
    const { rows } = await pool.query("SELECT id, name, password_hash FROM staff_accounts WHERE password_hash IS NOT NULL");
    for (const row of rows) {
      if (await bcrypt.compare(provided, row.password_hash)) {
        return { role: "staff", id: row.id, name: row.name };
      }
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
