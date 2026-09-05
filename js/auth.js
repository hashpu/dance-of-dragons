/* ---------------------------------------------------------------
   Discord "Sign in" via OAuth2 implicit grant (client-side only,
   no backend/secret needed — response_type=token, scope=identify).

   IMPORTANT: the redirect URL below must be added as a valid OAuth2
   Redirect in the Discord Developer Portal for this application
   (Discord Developer Portal → your app → OAuth2 → Redirects → Add).
   It's computed from wherever this site is actually hosted, so once
   you deploy it, add THAT deployed URL + "/auth-callback.html" there.
   Discord will reject the login otherwise ("Invalid redirect_uri").

   Sign-in cannot work when the site is opened as a local file — OAuth
   redirects must be http/https. It works once the site is served
   (a local dev server for testing, or wherever you deploy it).
------------------------------------------------------------------ */
const DISCORD_CLIENT_ID = "1543804550799163452";
const DISCORD_AUTH_STORAGE_KEY = "got-lore-discord-user";

function getAuthRedirectUri() {
  return new URL("auth-callback.html", document.baseURI).href;
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

function signOutDiscord() {
  localStorage.removeItem(DISCORD_AUTH_STORAGE_KEY);
  location.reload();
}

function beginDiscordLogin() {
  if (location.protocol === "file:") {
    alert(
      "Discord sign-in needs this site to be served over http/https — it can't complete from a local file.\n\n" +
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
