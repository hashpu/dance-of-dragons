const crypto = require("crypto");
const bcrypt = require("bcrypt");
const express = require("express");
const { pool } = require("../db");
const { seed, seedMissingHouses } = require("../seed");
const { requireAdmin, requireOwner } = require("../middleware/requireAdmin");

const router = express.Router();

// GET /api/admin/whoami — tells the dashboard whether the caller is the
// owner or a named staff account, so it knows which controls to show.
router.get("/whoami", requireAdmin, (req, res) => {
  res.json(req.admin);
});

// GET /api/admin/staff — owner only: lists staff accounts (never their
// passwords, only ever stored as bcrypt hashes).
router.get("/staff", requireOwner, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, name, created_at FROM staff_accounts ORDER BY created_at");
    res.json(rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at })));
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/staff { name, password } — owner only: creates a staff
// account with its own password, giving them admin-dashboard access
// without ever sharing the real ADMIN_SECRET.
router.post("/staff", requireOwner, async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const password = req.body.password || "";
    if (!name) return res.status(400).json({ error: "A name is required." });
    if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });

    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO staff_accounts (id, name, password_hash) VALUES ($1,$2,$3)", [id, name, hash]);
    res.status(201).json({ id, name });
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

// POST /api/admin/reset — wipes and reseeds all houses/members/applications.
// Destructive: erases every visitor's family trees back to defaults. Only
// for the owner's own deliberate "reset everything" request.
router.post("/reset", requireOwner, async (req, res, next) => {
  try {
    await seed(pool);
    await pool.query("TRUNCATE applications RESTART IDENTITY");
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
