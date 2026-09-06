/* Verifies whether the person making a request is a house's "Lord", so they
   can manage it without needing the house's shared password.

   Two ways to grant this, checked in order:

   0. Direct Discord ID (lord_discord_user_id) — an admin assigns one exact
      Discord user ID to the house. Whoever is signed in to Discord with
      that account gets Lord access. No bot, guild, or Roblox setup needed.

   1+2. Discord role + Roblox account (lord_role_id / lord_roblox_user_id) —
      the visitor's Discord OAuth token (plain "identify" scope) proves who
      they are via /users/@me, the site's bot looks up their roles in the
      guild, AND their Roblox OAuth token (see roblox.js) must belong to the
      exact Roblox account an admin assigned to this house. Requiring both
      stops anyone who merely holds the Discord role (e.g. it was handed out
      broadly, or leaked) from claiming Lord access on a house that isn't
      theirs. Requires DISCORD_GUILD_ID and DISCORD_BOT_TOKEN — without
      either, this path always returns false. */

const { verifyRequestRobloxUserId } = require("./roblox");

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

// The verified Discord ID of whoever is making this request, if any — used
// for audit-log messages so a Lord action can say who did it.
async function getRequestDiscordUserId(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  return verifyDiscordUserId(token);
}

async function isLordOfHouse(req, house) {
  // Simple path: a specific Discord user ID was assigned directly — no bot,
  // guild role lookup, or Roblox account needed.
  if (house.lord_discord_user_id) {
    const userId = await getRequestDiscordUserId(req);
    if (userId && userId === house.lord_discord_user_id) return true;
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !process.env.DISCORD_BOT_TOKEN || !house.lord_role_id || !house.lord_roblox_user_id) {
    return false;
  }

  const userId = await getRequestDiscordUserId(req);
  if (!userId) return false;

  const roles = await getGuildMemberRoles(userId, guildId);
  if (!roles || !roles.includes(house.lord_role_id)) return false;

  const robloxUserId = await verifyRequestRobloxUserId(req);
  return robloxUserId === house.lord_roblox_user_id;
}

function isAdminRequest(req) {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.get("x-admin-secret") === secret;
}

module.exports = { isLordOfHouse, isAdminRequest, getRequestDiscordUserId };
