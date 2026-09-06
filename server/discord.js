/* Verifies whether the signed-in Discord user making a request holds the
   "Lord" role assigned to a given house, so they can manage it without
   needing the house's shared password.

   Two-step, using the site's own Discord bot rather than asking every
   visitor to grant extra permissions:
   1. The visitor's OAuth token (plain "identify" scope) proves who they
      really are — we call Discord's /users/@me with it to get their ID.
   2. The bot token (full access to the server) looks up that verified
      user's actual roles in the guild.

   Requires DISCORD_GUILD_ID and DISCORD_BOT_TOKEN — without either, this
   always returns false and every house falls back to password-only access
   (safe default; the bot also needs to actually be a member of that server). */

function getBearerToken(req) {
  const auth = req.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

async function verifyDiscordUserId(accessToken) {
  try {
    const res = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    const me = await res.json();
    return me.id || null;
  } catch (e) {
    return null;
  }
}

async function getGuildMemberRoles(userId, guildId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return null;
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${botToken}` }
    });
    if (!res.ok) return null;
    const member = await res.json();
    return member.roles || [];
  } catch (e) {
    return null;
  }
}

async function isLordOfHouse(req, house) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !process.env.DISCORD_BOT_TOKEN || !house.lord_role_id) return false;

  const token = getBearerToken(req);
  if (!token) return false;

  const userId = await verifyDiscordUserId(token);
  if (!userId) return false;

  const roles = await getGuildMemberRoles(userId, guildId);
  return !!roles && roles.includes(house.lord_role_id);
}

function isAdminRequest(req) {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.get("x-admin-secret") === secret;
}

module.exports = { isLordOfHouse, isAdminRequest };
