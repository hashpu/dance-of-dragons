const express = require("express");
const { exchangeRobloxCode, getRobloxUserInfo } = require("../roblox");

const router = express.Router();

// POST /api/roblox/exchange { code, redirectUri, codeVerifier } — completes the
// PKCE authorization-code flow server-side (needs the client secret, which the
// browser must never see) and hands back the verified Roblox identity.
router.post("/exchange", async (req, res, next) => {
  try {
    const { code, redirectUri, codeVerifier } = req.body;
    if (!code || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: "Missing code, redirectUri, or codeVerifier." });
    }

    const tokenData = await exchangeRobloxCode(code, redirectUri, codeVerifier);
    const info = await getRobloxUserInfo(tokenData.access_token);
    if (!info) return res.status(401).json({ error: "Could not verify the Roblox account." });

    res.json({
      userId: info.id,
      username: info.username,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in
    });
  } catch (err) {
    if (err.message === "Roblox sign-in isn't configured on this server yet." || err.message === "Roblox rejected that sign-in attempt.") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
