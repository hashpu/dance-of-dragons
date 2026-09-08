/* ---------------------------------------------------------------
   Discord "Sign in" via OAuth2 implicit grant (client-side only,
   no backend/secret needed — response_type=token, scope=identify).

   IMPORTANT: the redirect URL below must be added as a valid OAuth2
   Redirect in the Discord Developer Portal for this application
   (Discord Developer Portal → your app → OAuth2 → Redirects → Add).
   It's the site's own root URL, so once you deploy it, add that
   deployed root URL there. Discord will reject the login otherwise
   ("Invalid redirect_uri"). The redirect always lands back at the
   root with the token in the URL fragment; consumeAuthRedirectHash()
   below (called from nav.js on every page) picks it up from there
   and bounces the user back to whichever page they signed in from.

   Sign-in cannot work when the site is opened as a local file — OAuth
   redirects must be http/https. It works once the site is served
   (a local dev server for testing, or wherever you deploy it).
------------------------------------------------------------------ */
const DISCORD_CLIENT_ID = "1545917487063892150";
const DISCORD_AUTH_STORAGE_KEY = "got-lore-discord-user";

function getAuthRedirectUri() {
  return location.origin + "/";
}

// Runs on every page load (from nav.js). If Discord just redirected back
// here with a token/error in the URL fragment, consumes it: signs the user
// in (or reports the error), strips the fragment, and returns to whatever
// page they started sign-in from.
async function consumeAuthRedirectHash() {
  if (!/access_token=|[?&#]error=/.test(location.hash)) return;

  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get("access_token");
  const error = params.get("error");
  const returnTo = sessionStorage.getItem("postAuthReturnTo");
  sessionStorage.removeItem("postAuthReturnTo");
  history.replaceState(null, "", location.pathname + location.search);

  if (error) {
    alert("Discord sign-in failed: " + error);
    return;
  }
  if (!token) return;

  const expiresIn = Number(params.get("expires_in")) || 0;
  try {
    const res = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Discord API responded with " + res.status);
    const me = await res.json();
    setDiscordUser({
      id: me.id,
      username: me.username,
      discriminator: me.discriminator,
      avatar: me.avatar,
      accessToken: token,
      tokenExpiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null
    });
  } catch (e) {
    alert("Couldn't verify your Discord account: " + e.message);
    return;
  }

  if (returnTo && returnTo !== location.href) location.href = returnTo;
}

function getDiscordUser() {
  try {
    const raw = localStorage.getItem(DISCORD_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setDiscordUser(user) {
  localStorage.setItem(DISCORD_AUTH_STORAGE_KEY, JSON.stringify(user));
}

// The raw Discord access token, used server-side to check "Lord" role
// membership for a house — returns null once it's expired.
function getDiscordAccessToken() {
  const user = getDiscordUser();
  if (!user || !user.accessToken || !user.tokenExpiresAt) return null;
  if (Date.now() > user.tokenExpiresAt) return null;
  return user.accessToken;
}

function signOutDiscord() {
  localStorage.removeItem(DISCORD_AUTH_STORAGE_KEY);
  location.reload();
}

function beginDiscordLogin() {
  if (location.protocol === "file:") {
    alert(
      "Discord sign-in needs this site to be served over http/https. It can't complete from a local file.\n\n" +
      "Host the site (even a local dev server works for testing), then add its auth-callback.html URL as an OAuth2 redirect for this app in the Discord Developer Portal."
    );
    return;
  }
  sessionStorage.setItem("postAuthReturnTo", location.href);
  const redirect = getAuthRedirectUri();
  const url =
    "https://discord.com/oauth2/authorize" +
    "?client_id=" + DISCORD_CLIENT_ID +
    "&redirect_uri=" + encodeURIComponent(redirect) +
    "&response_type=token&scope=identify";
  location.href = url;
}

function discordAvatarUrl(user) {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
  }
  const idx = user.discriminator && user.discriminator !== "0" ? Number(user.discriminator) % 5 : 0;
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
