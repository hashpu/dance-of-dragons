const express = require("express");
const { pool } = require("../db");
const { seed, seedMissingHouses } = require("../seed");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

// POST /api/admin/reset — wipes and reseeds all houses/members/applications.
// Destructive: erases every visitor's family trees back to defaults. Only
// for an admin's own deliberate "reset everything" request.
router.post("/reset", requireAdmin, async (req, res, next) => {
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
// Only ever touches the named house.
router.delete("/houses/:slug", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query("DELETE FROM houses WHERE slug = $1 RETURNING slug", [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: "House not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
