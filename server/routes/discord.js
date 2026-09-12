const express = require("express");
const { getRequestDiscordUser } = require("../discord");

const router = express.Router();

// GET /api/discord/me — verifies whoever's Discord token is attached (if
// any) and reports their identity. The verification itself is what matters
// here, not the response: it's what makes discord.js's recordDiscordUserSeen
// run (see the admin/house-scoped Discord-user search this powers).
//
// Most other routes only verify a caller's Discord identity as a side
// effect of checking something specific — a Lord assignment, a vote — so a
// signed-in visitor who never happens to trigger one of those checks (e.g.
// they just browse an unlocked house, or a locked one with no Lord set yet)
// was never actually recorded. nav.js calls this once per page load
// whenever a Discord token is present, so simply being signed in anywhere
// on the site is enough.
router.get("/me", async (req, res, next) => {
  try {
    const user = await getRequestDiscordUser(req);
    res.json(user ? { signedIn: true, id: user.id, username: user.username } : { signedIn: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
