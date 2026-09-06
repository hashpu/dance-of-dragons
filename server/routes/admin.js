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

module.exports = router;
