const express = require("express");
const { pool } = require("../db");
const { getRequestDiscordUserId } = require("../discord");

const router = express.Router();
const VALID_CHOICES = new Set(["green", "black"]);

// GET /api/votes — public tally (green/black/total), plus the caller's own
// vote if they're signed in with Discord.
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT choice, COUNT(*)::int AS count FROM votes GROUP BY choice");
    const tally = { green: 0, black: 0 };
    rows.forEach((r) => {
      if (VALID_CHOICES.has(r.choice)) tally[r.choice] = r.count;
    });

    const userId = await getRequestDiscordUserId(req);
    let myVote = null;
    if (userId) {
      const mine = await pool.query("SELECT choice FROM votes WHERE discord_user_id = $1", [userId]);
      myVote = mine.rows[0] ? mine.rows[0].choice : null;
    }

    res.json({ green: tally.green, black: tally.black, total: tally.green + tally.black, myVote });
  } catch (err) {
    next(err);
  }
});

// POST /api/votes { choice: "green" | "black" } — requires being signed in
// with Discord (plain "identify" scope, same sign-in already used
// site-wide). One vote per Discord account; voting again changes your pick
// instead of adding a second vote.
router.post("/", async (req, res, next) => {
  try {
    const { choice } = req.body;
    if (!VALID_CHOICES.has(choice)) return res.status(400).json({ error: 'Choice must be "green" or "black".' });

    const userId = await getRequestDiscordUserId(req);
    if (!userId) return res.status(401).json({ error: "Sign in with Discord to vote." });

    await pool.query(
      `INSERT INTO votes (discord_user_id, choice) VALUES ($1, $2)
       ON CONFLICT (discord_user_id) DO UPDATE SET choice = $2, created_at = now()`,
      [userId, choice]
    );

    res.json({ ok: true, choice });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
