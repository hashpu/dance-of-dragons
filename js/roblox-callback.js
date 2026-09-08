(async function () {
  document.getElementById("brandIcon").innerHTML = HOUSE_ICONS.targaryen;

  const titleEl = document.getElementById("authTitle");
  const messageEl = document.getElementById("authMessage");
  const backLink = document.getElementById("authBackLink");
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const error = params.get("error");
  const verifier = sessionStorage.getItem("robloxPkceVerifier");
  sessionStorage.removeItem("robloxPkceVerifier");

  function fail(msg) {
    titleEl.textContent = "Roblox sign-in failed";
    messageEl.textContent = msg;
    backLink.hidden = false;
  }

  if (error) {
    fail("Roblox said: " + error);
    return;
  }
  if (!code || !verifier) {
    fail("No authorization code was returned by Roblox.");
    return;
  }

  try {
    const res = await fetch("/api/roblox/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri: getRobloxCallbackUri(), codeVerifier: verifier })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed.");

    setRobloxUser({
      id: data.userId,
      username: data.username,
      accessToken: data.accessToken,
      tokenExpiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : null
    });

    const returnTo = sessionStorage.getItem("postAuthReturnTo") || "/";
    sessionStorage.removeItem("postAuthReturnTo");
    location.href = returnTo;
  } catch (e) {
    fail("Couldn't verify your Roblox account: " + e.message);
  }
})();
