const crypto = require("crypto");
const bcrypt = require("bcrypt");
const express = require("express");
const { pool } = require("../db");
const { seed, seedMissingHouses } = require("../seed");
const { findDepartment } = require("../departments");
const { requireAdmin, requireOwner } = require("../middleware/requireAdmin");

const router = express.Router();

// GET /api/admin/whoami — tells the dashboard whether the caller is the
// owner or a named staff account, so it knows which controls to show.
router.get("/whoami", requireAdmin, (req, res) => {
  res.json(req.admin);
});

// GET /api/admin/staff — owner only: lists staff accounts, with a live
// avatar/username for Discord-based ones (joined from discord_users so it
// stays current even if they change their Discord name later).
router.get("/staff", requireOwner, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name, s.created_at, s.discord_user_id, du.username AS discord_username, du.avatar AS discord_avatar
      FROM staff_accounts s
      LEFT JOIN discord_users du ON du.id = s.discord_user_id
      ORDER BY s.created_at
    `);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.discord_username || r.name,
        avatar: r.discord_avatar || "",
        discordUserId: r.discord_user_id,
        createdAt: r.created_at
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/staff — owner only: grants staff access. Either
// { discordUserId } (to an account that's already signed in on the site at
// least once), { name, password } (a standalone login for someone without a
// Discord account to link), or discordUserId + password together — that
// account can then log in either way, since identifyAdmin already checks
// Discord first and falls back to the password hash.
router.post("/staff", requireOwner, async (req, res, next) => {
  try {
    const discordUserId = (req.body.discordUserId || "").trim();
    const name = (req.body.name || "").trim();
    const password = req.body.password || "";

    if (discordUserId) {
      const { rows: du } = await pool.query("SELECT id, username FROM discord_users WHERE id = $1", [discordUserId]);
      if (!du[0]) return res.status(400).json({ error: "That account hasn't signed in on the site yet." });

      const { rows: existing } = await pool.query("SELECT id FROM staff_accounts WHERE discord_user_id = $1", [discordUserId]);
      if (existing[0]) return res.status(400).json({ error: "That account already has staff access." });

      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      const id = crypto.randomUUID();
      await pool.query(
        "INSERT INTO staff_accounts (id, name, discord_user_id, password_hash) VALUES ($1,$2,$3,$4)",
        [id, du[0].username, discordUserId, passwordHash]
      );
      return res.status(201).json({ id, name: du[0].username });
    }

    if (name && password) {
      const hash = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();
      await pool.query("INSERT INTO staff_accounts (id, name, password_hash) VALUES ($1,$2,$3)", [id, name, hash]);
      return res.status(201).json({ id, name });
    }

    res.status(400).json({ error: "Pick a Discord account, or provide a name and password." });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/staff/:id — owner only: revokes one staff account.
router.delete("/staff/:id", requireOwner, async (req, res, next) => {
  try {
    const { rows } = await pool.query("DELETE FROM staff_accounts WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Staff account not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/departments/:key/close — closes a department to new
// applications. Staff-allowed (safe, reversible) like seed-missing below,
// not owner-only. The actual enforcement is server-side in POST
// /api/applications — this just flips the switch it checks.
router.post("/departments/:key/close", requireAdmin, async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!findDepartment(key)) return res.status(404).json({ error: "Unknown department." });
    const { rows: existing } = await pool.query("SELECT department FROM closed_departments WHERE department = $1", [key]);
    if (!existing[0]) {
      await pool.query("INSERT INTO closed_departments (department) VALUES ($1)", [key]);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/departments/:key/open — reopens one.
router.post("/departments/:key/open", requireAdmin, async (req, res, next) => {
  try {
    await pool.query("DELETE FROM closed_departments WHERE department = $1", [req.params.key]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/reset — wipes and reseeds all houses/members/applications.
// Destructive: erases every visitor's family trees back to defaults. Only
// for the owner's own deliberate "reset everything" request.
router.post("/reset", requireOwner, async (req, res, next) => {
  try {
    await seed(pool);
    // application_messages has a foreign key onto applications, so a plain
    // TRUNCATE applications fails — Postgres refuses to truncate a
    // referenced table even if the referencing one is empty. CASCADE also
    // truncates application_messages automatically.
    await pool.query("TRUNCATE applications RESTART IDENTITY CASCADE");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/seed-missing — adds any house from server/seed.js's
// HOUSES list that isn't in the database yet. Safe to call any time: it
// never touches an existing house or its members, so this (not /reset) is
// how new houses should get added to a live site.
router.post("/seed-missing", requireAdmin, async (req, res, next) => {
  try {
    const added = await seedMissingHouses(pool);
    res.json({ ok: true, added });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/houses — full admin view of every house: lock status,
// whether a password is set (never the password itself — it's only ever
// stored as a bcrypt hash, so there is nothing to reveal), and who's
// assigned as Lord. Used by the admin dashboard.
router.get("/houses", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT h.slug, h.name, h.faction, h.locked, h.password_hash,
             h.lord_discord_user_id, h.lord_role_id, h.lord_roblox_user_id,
             COUNT(m.id) AS member_count
      FROM houses h
      LEFT JOIN members m ON m.house_slug = h.slug
      GROUP BY h.slug, h.name, h.faction, h.locked, h.password_hash,
               h.lord_discord_user_id, h.lord_role_id, h.lord_roblox_user_id
      ORDER BY h.order_index
    `);
    res.json(
      rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        faction: row.faction,
        locked: row.locked,
        hasPassword: Boolean(row.password_hash),
        lordDiscordUserId: row.lord_discord_user_id,
        lordRoleId: row.lord_role_id,
        lordRobloxUserId: row.lord_roblox_user_id,
        memberCount: Number(row.member_count)
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/discord-users?q= — searches Discord accounts that have
// actually signed in on the site before (see discord.js's
// recordDiscordUserSeen), by username substring. Powers two things: the
// "assign a Lord" picker (owner-only in the UI, but this endpoint itself is
// staff-readable like the Houses/Applications tabs) so an admin picks a
// real, verified account instead of pasting a raw ID, and the "Discord
// sign-ins" log tab. Someone who has never signed in here simply won't show
// up. Empty/missing q returns the most recently seen accounts instead of
// every match, so both the picker and the log have something to show
// before you start typing.
router.get("/discord-users", requireAdmin, async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const { rows } = await pool.query(
      `SELECT id, username, avatar, last_seen_at FROM discord_users
       WHERE $1 = '' OR username ILIKE '%' || $1 || '%'
       ORDER BY last_seen_at DESC
       LIMIT 100`,
      [q]
    );
    res.json(rows.map((r) => ({ id: r.id, username: r.username, avatar: r.avatar, lastSeenAt: r.last_seen_at })));
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/houses/:slug/reset-password { password } — owner only:
// directly sets a house's password to a new value the owner chooses, in one
// step (unlike /lock, which only accepts a password the first time a house
// is ever locked). The old password stops working immediately.
router.post("/houses/:slug/reset-password", requireOwner, async (req, res, next) => {
  try {
    const password = req.body.password || "";
    if (!password) return res.status(400).json({ error: "A password is required." });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query("UPDATE houses SET locked = true, password_hash = $2 WHERE slug = $1 RETURNING slug", [
      req.params.slug,
      hash
    ]);
    if (!rows[0]) return res.status(404).json({ error: "House not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/houses/:slug — removes one house and its members
// entirely (e.g. to clean up a house added with the wrong slug/name).
// Only ever touches the named house. Owner only.
router.delete("/houses/:slug", requireOwner, async (req, res, next) => {
  try {
    const { rows } = await pool.query("DELETE FROM houses WHERE slug = $1 RETURNING slug", [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: "House not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
