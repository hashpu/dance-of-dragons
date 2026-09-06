const express = require("express");
const { pool } = require("../db");

const router = express.Router();

// GET /api/uploads/:id — serves a file stored in the database (see
// server/uploads.js for how these get saved). Cached hard since an id is
// never reused for different content.
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT mime_type, data FROM uploaded_files WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    res.set("Content-Type", rows[0].mime_type);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(rows[0].data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
