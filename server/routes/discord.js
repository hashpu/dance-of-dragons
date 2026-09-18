const express = require("express");
const { getRequestDiscordUser, getGuildMemberRoles, getGuildRoles } = require("../discord");

const router = express.Router();

// A signed-in visitor's own Discord server roles (name + color), for display
// on their profile card — id/name pairs only, the @everyone role stripped,
// highest role first. Empty (never null) when the bot isn't configured or
// the lookup fails, so the caller never has to distinguish "no roles" from
// "couldn't check."
async function getDisplayRoles(userId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) return [];

  const [memberRoleIds, guildRoles] = await Promise.all([getGuildMemberRoles(userId, guildId), getGuildRoles(guildId)]);
  if (!memberRoleIds || !guildRoles) return [];

  const rolesById = new Map(guildRoles.map((r) => [r.id, r]));
  return memberRoleIds
    .map((id) => rolesById.get(id))
    .filter((r) => r && r.id !== guildId)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

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
    if (!user) return res.json({ signedIn: false });
    const roles = await getDisplayRoles(user.id);
    res.json({ signedIn: true, id: user.id, username: user.username, roles });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
