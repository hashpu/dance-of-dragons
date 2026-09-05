/* Verifies whether the signed-in Discord user making a request holds the
   "Lord" role assigned to a given house, so they can manage it without
   needing the house's shared password.

   Requires DISCORD_GUILD_ID to be set — without it, this always returns
   false and every house falls back to password-only access (safe default). */

function getBearerToken(req) {
  const auth = req.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

async function getGuildMemberRoles(accessToken, guildId) {
  try {
    const res = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` }
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
  if (!guildId || !house.lord_role_id) return false;

  const token = getBearerToken(req);
  if (!token) return false;

  const roles = await getGuildMemberRoles(token, guildId);
  return !!roles && roles.includes(house.lord_role_id);
}

function isAdminRequest(req) {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.get("x-admin-secret") === secret;
}

module.exports = { isLordOfHouse, isAdminRequest };
