/* ---------------------------------------------------------------
   "Link Roblox" via OAuth2 authorization-code + PKCE (Roblox doesn't
   support the implicit token flow Discord uses, so the authorization code
   is exchanged for a token server-side, in server/routes/roblox.js, where
   the client secret can safely live).

   IMPORTANT: add "<this site>/roblox-callback.html" as a redirect URI for
   your app in the Roblox Creator Hub (Credentials → OAuth 2.0 Apps), the
   same way the Discord redirect is registered.
------------------------------------------------------------------ */
const ROBLOX_CLIENT_ID = "0"; // Set to your Roblox OAuth app's client ID.
const ROBLOX_AUTH_STORAGE_KEY = "got-lore-roblox-user";
const ROBLOX_VERIFIER_KEY = "robloxPkceVerifier";

function getRobloxCallbackUri() {
  return new URL("roblox-callback.html", document.baseURI).href;
}

function getRobloxUser() {
  try {
    const raw = localStorage.getItem(ROBLOX_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setRobloxUser(user) {
  localStorage.setItem(ROBLOX_AUTH_STORAGE_KEY, JSON.stringify(user));
}

// The raw Roblox access token, used server-side to verify Lord access —
// returns null once it's expired (Roblox tokens are short-lived; re-linking
// is required rather than silently refreshing, matching the Discord flow).
function getRobloxAccessToken() {
  const user = getRobloxUser();
  if (!user || !user.accessToken || !user.tokenExpiresAt) return null;
  if (Date.now() > user.tokenExpiresAt) return null;
  return user.accessToken;
}

function signOutRoblox() {
  localStorage.removeItem(ROBLOX_AUTH_STORAGE_KEY);
  location.reload();
}

function base64UrlEncode(bytes) {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomPkceVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

async function beginRobloxLogin() {
  if (location.protocol === "file:") {
    alert("Roblox sign-in needs this site to be served over http/https. It can't complete from a local file.");
    return;
  }
  const verifier = randomPkceVerifier();
  sessionStorage.setItem(ROBLOX_VERIFIER_KEY, verifier);
  sessionStorage.setItem("postAuthReturnTo", location.href);
  const challenge = await pkceChallenge(verifier);
  const redirect = getRobloxCallbackUri();
  const url =
    "https://apis.roblox.com/oauth/v1/authorize" +
    "?client_id=" + ROBLOX_CLIENT_ID +
    "&redirect_uri=" + encodeURIComponent(redirect) +
    "&scope=" + encodeURIComponent("openid profile") +
    "&response_type=code" +
    "&code_challenge=" + challenge +
    "&code_challenge_method=S256";
  location.href = url;
}
