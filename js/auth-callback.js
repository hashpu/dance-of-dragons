(async function () {
  document.getElementById("brandIcon").innerHTML = HOUSE_ICONS.targaryen;

  const titleEl = document.getElementById("authTitle");
  const messageEl = document.getElementById("authMessage");
  const backLink = document.getElementById("authBackLink");
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get("access_token");
  const expiresIn = Number(params.get("expires_in")) || 0;
  const error = params.get("error");

  function fail(msg) {
    titleEl.textContent = "Sign-in failed";
    messageEl.textContent = msg;
    backLink.hidden = false;
  }

  if (error) {
    fail("Discord said: " + error);
    return;
  }
  if (!token) {
    fail("No access token was returned by Discord.");
    return;
  }

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
    const returnTo = sessionStorage.getItem("postAuthReturnTo") || "index.html";
    sessionStorage.removeItem("postAuthReturnTo");
    location.href = returnTo;
  } catch (e) {
    fail("Couldn't verify your Discord account — " + e.message);
  }
})();
