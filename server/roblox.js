/* Roblox OAuth 2.0 (authorization-code + PKCE) identity verification, used
   alongside Discord to confirm a "Lord" is really the specific Roblox
   account an admin assigned to a house — not just anyone holding the
   Discord role.

   Requires ROBLOX_CLIENT_ID and ROBLOX_CLIENT_SECRET from a Roblox OAuth
   app (Creator Hub -> Credentials -> OAuth 2.0 Apps). Without them, Roblox
   verification always fails closed (safe default). */

async function exchangeRobloxCode(code, redirectUri, codeVerifier) {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const clientSecret = process.env.ROBLOX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Roblox sign-in isn't configured on this server yet.");
  }

  const res = await fetch("https://apis.roblox.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier
    })
  });
  if (!res.ok) throw new Error("Roblox rejected that sign-in attempt.");
  return res.json(); // { access_token, refresh_token, expires_in, token_type }
}

async function getRobloxUserInfo(accessToken) {
  try {
    const res = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    const info = await res.json();
    if (!info.sub) return null;
    return { id: String(info.sub), username: info.preferred_username || info.nickname || null };
  } catch (e) {
    return null;
  }
}

// Admin convenience: turn a typed Roblox username into the stable numeric ID
// that's actually stored and compared (usernames can change; IDs don't).
async function resolveRobloxUsername(username) {
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data.data && data.data[0];
    return match ? { id: String(match.id), username: match.name } : null;
  } catch (e) {
    return null;
  }
}

// Public data (no token needed) — used to show a linked account's in-game
// badges on their profile card. Roblox's badge API doesn't allow browser
// CORS requests, so this has to be proxied through the server.
async function getRobloxUserBadges(userId) {
  const res = await fetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=10&sortOrder=Desc`);
  if (!res.ok) return [];
  const data = await res.json();
  const badges = data.data || [];
  if (!badges.length) return [];

  const ids = badges.map((b) => b.id).join(",");
  const iconRes = await fetch(
    `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${ids}&size=150x150&format=Png&isCircular=false`
  );
  const icons = iconRes.ok ? (await iconRes.json()).data || [] : [];
  const iconByBadgeId = new Map(icons.map((i) => [i.targetId, i.imageUrl]));

  return badges.map((b) => ({ id: b.id, name: b.displayName || b.name, iconUrl: iconByBadgeId.get(b.id) || null }));
}

function getRobloxBearerToken(req) {
  const header = req.get("x-roblox-token") || "";
  return header.trim() || null;
}

// The verified Roblox user ID of whoever is making this request, if any.
async function verifyRequestRobloxUserId(req) {
  const token = getRobloxBearerToken(req);
  if (!token) return null;
  const info = await getRobloxUserInfo(token);
  return info ? info.id : null;
}

module.exports = {
  exchangeRobloxCode,
  getRobloxUserInfo,
  getRobloxUserBadges,
  resolveRobloxUsername,
  verifyRequestRobloxUserId
};
