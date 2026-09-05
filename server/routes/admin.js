const express = require("express");
const { pool } = require("../db");
const { seed } = require("../seed");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

// POST /api/admin/reset — wipes and reseeds all houses/members/applications
router.post("/reset", requireAdmin, async (req, res, next) => {
  try {
    await seed(pool);
    await pool.query("TRUNCATE applications RESTART IDENTITY");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
