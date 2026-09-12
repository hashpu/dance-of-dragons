const test = require("node:test");
const assert = require("node:assert");
process.env.ADMIN_SECRET = "test-secret";
process.env.DISCORD_GUILD_ID = "guild-123";
process.env.DISCORD_BOT_TOKEN = "test-bot-token";

const { setupTestDb } = require("../db-test-utils");
const memPool = setupTestDb();
const { seed } = require("../seed");
const app = require("../app");
const request = require("supertest")(app);

test.before(async () => {
  await seed(memPool);
});

// Mocks every external API call the Lord-access checks make, without touching
// the real network:
//   - Discord identify (visitor's OAuth token -> their Discord user ID)
//   - Discord guild member lookup (bot token -> that user's roles)
//   - Roblox userinfo (visitor's Roblox OAuth token -> their Roblox user ID)
//   - Roblox username resolution (admin assignment -> a numeric user ID)
const realFetch = global.fetch;
function mockNetwork({ discordTokens = {}, robloxTokens = {}, robloxUsernames = {} } = {}) {
  global.fetch = async (url, opts) => {
    const urlStr = String(url);
    const authHeader = (opts && opts.headers && opts.headers.Authorization) || "";

    if (urlStr === "https://discord.com/api/users/@me") {
      const entry = discordTokens[authHeader.replace("Bearer ", "")];
      if (!entry) return { ok: false, status: 401 };
      return { ok: true, json: async () => ({ id: entry.userId, username: entry.username }) };
    }
    if (urlStr.includes("discord.com") && urlStr.includes("/guilds/") && urlStr.includes("/members/")) {
      assert.equal(authHeader, `Bot ${process.env.DISCORD_BOT_TOKEN}`);
      const userId = urlStr.split("/members/")[1];
      const entry = Object.values(discordTokens).find((e) => e.userId === userId);
      if (!entry) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ roles: entry.roles }) };
    }
    if (urlStr === "https://apis.roblox.com/oauth/v1/userinfo") {
      const entry = robloxTokens[authHeader.replace("Bearer ", "")];
      if (!entry) return { ok: false, status: 401 };
      return { ok: true, json: async () => ({ sub: entry.userId, preferred_username: entry.username }) };
    }
    if (urlStr === "https://users.roblox.com/v1/usernames/users") {
      const body = JSON.parse(opts.body);
      const match = robloxUsernames[body.usernames[0]];
      return { ok: true, json: async () => ({ data: match ? [{ id: Number(match.id), name: match.name }] : [] }) };
    }
    return realFetch(url, opts);
  };
}

test.after(() => {
  global.fetch = realFetch;
});

test("assigning a lord requires the admin secret, and resolves the Roblox username to an ID", async () => {
  const noAuth = await request.post("/api/houses/stark/lord-role").send({ roleId: "role-stark-lord" });
  assert.equal(noAuth.status, 401);

  mockNetwork({ robloxUsernames: { WinterfellKing: { id: "12345", name: "WinterfellKing" } } });

  const badUsername = await request
    .post("/api/houses/stark/lord-role")
    .set("x-admin-secret", "test-secret")
    .send({ roleId: "role-stark-lord", robloxUsername: "NoSuchUser" });
  assert.equal(badUsername.status, 400);

  const res = await request
    .post("/api/houses/stark/lord-role")
    .set("x-admin-secret", "test-secret")
    .send({ roleId: "role-stark-lord", robloxUsername: "WinterfellKing" });
  assert.equal(res.status, 200);
  assert.equal(res.body.robloxUserId, "12345");
});

test("without any tokens, the house still looks locked to everyone", async () => {
  const res = await request.get("/api/houses/stark");
  assert.equal(res.body.locked, true);
  assert.equal(res.body.members, undefined);
  assert.equal(res.body.lordAccess, undefined);
});

test("a user with BOTH the Discord role and the matching Roblox account gets Lord access", async () => {
  mockNetwork({
    discordTokens: { "good-token": { userId: "user-1", roles: ["role-stark-lord", "some-other-role"] } },
    robloxTokens: { "good-roblox-token": { userId: "12345", username: "WinterfellKing" } }
  });

  const withToken = await request
    .get("/api/houses/stark")
    .set("Authorization", "Bearer good-token")
    .set("X-Roblox-Token", "good-roblox-token");
  assert.equal(withToken.body.locked, true);
  assert.equal(withToken.body.lordAccess, true);
  assert.ok(Array.isArray(withToken.body.members));

  const add = await request
    .post("/api/houses/stark/members")
    .set("Authorization", "Bearer good-token")
    .set("X-Roblox-Token", "good-roblox-token")
    .send({ name: "Lord-Added Member" });
  assert.equal(add.status, 201);
  const addedId = add.body.id;

  // a Lord can add, but not edit or remove — even their own newly-added member
  const edit = await request
    .patch(`/api/houses/stark/members/${addedId}`)
    .set("Authorization", "Bearer good-token")
    .set("X-Roblox-Token", "good-roblox-token")
    .send({ name: "Renamed" });
  assert.equal(edit.status, 403);

  const remove = await request
    .delete(`/api/houses/stark/members/${addedId}`)
    .set("Authorization", "Bearer good-token")
    .set("X-Roblox-Token", "good-roblox-token");
  assert.equal(remove.status, 403);
});

test("the Discord role alone isn't enough without a matching Roblox account", async () => {
  mockNetwork({
    discordTokens: { "good-token": { userId: "user-1", roles: ["role-stark-lord"] } },
    robloxTokens: { "wrong-roblox-token": { userId: "99999", username: "SomeoneElse" } }
  });

  const noRoblox = await request
    .post("/api/houses/stark/members")
    .set("Authorization", "Bearer good-token")
    .send({ name: "Should Fail" });
  assert.equal(noRoblox.status, 403);

  const wrongRoblox = await request
    .post("/api/houses/stark/members")
    .set("Authorization", "Bearer good-token")
    .set("X-Roblox-Token", "wrong-roblox-token")
    .send({ name: "Should Also Fail" });
  assert.equal(wrongRoblox.status, 403);
});

test("a user without the assigned Discord role cannot edit the locked house", async () => {
  mockNetwork({ discordTokens: { "bad-token": { userId: "user-2", roles: ["some-unrelated-role"] } } });

  const res = await request
    .post("/api/houses/stark/members")
    .set("Authorization", "Bearer bad-token")
    .send({ name: "Should Fail" });
  assert.equal(res.status, 403);
});

test("an invalid/expired Discord OAuth token (fails identity check) is treated as no access", async () => {
  mockNetwork(); // no tokens recognized by /users/@me
  const res = await request.get("/api/houses/stark").set("Authorization", "Bearer garbage-token");
  assert.equal(res.body.locked, true);
  assert.equal(res.body.lordAccess, undefined);
});

test("a Discord ID assigned directly gets Lord access with no Roblox account or guild role needed", async () => {
  const noAuth = await request.post("/api/houses/hightower/lord-discord").send({ discordUserId: "user-99" });
  assert.equal(noAuth.status, 401);

  const assign = await request
    .post("/api/houses/hightower/lord-discord")
    .set("x-admin-secret", "test-secret")
    .send({ discordUserId: "user-99" });
  assert.equal(assign.status, 200);
  assert.equal(assign.body.discordUserId, "user-99");

  mockNetwork({ discordTokens: { "lord-token": { userId: "user-99", roles: [] } } });

  const withId = await request.get("/api/houses/hightower").set("Authorization", "Bearer lord-token");
  assert.equal(withId.body.locked, true);
  assert.equal(withId.body.lordAccess, true);

  mockNetwork({ discordTokens: { "other-token": { userId: "someone-else", roles: [] } } });
  const wrongId = await request.get("/api/houses/hightower").set("Authorization", "Bearer other-token");
  assert.equal(wrongId.body.lordAccess, undefined);

  await request.post("/api/houses/hightower/lord-discord").set("x-admin-secret", "test-secret").send({ discordUserId: "" });
});

test("a Discord-recognized Lord can change their own house's password with no admin secret and no old password", async () => {
  await request.post("/api/houses/hightower/lord-discord").set("x-admin-secret", "test-secret").send({ discordUserId: "lord-99" });

  const noAuth = await request.post("/api/houses/hightower/lord-password").send({ password: "newsecret" });
  assert.equal(noAuth.status, 401);

  mockNetwork({ discordTokens: { "impostor-token": { userId: "someone-else", roles: [] } } });
  const wrongLord = await request
    .post("/api/houses/hightower/lord-password")
    .set("Authorization", "Bearer impostor-token")
    .send({ password: "newsecret" });
  assert.equal(wrongLord.status, 401);

  mockNetwork({ discordTokens: { "lord-token": { userId: "lord-99", roles: [] } } });
  const asLord = await request
    .post("/api/houses/hightower/lord-password")
    .set("Authorization", "Bearer lord-token")
    .send({ password: "newsecret" });
  assert.equal(asLord.status, 200);

  const oldPassword = await request.post("/api/houses/hightower/unlock").send({ password: "oldtown" });
  assert.equal(oldPassword.status, 401);

  const newPassword = await request.post("/api/houses/hightower/unlock").send({ password: "newsecret" });
  assert.equal(newPassword.status, 200);

  await request.post("/api/houses/hightower/lord-discord").set("x-admin-secret", "test-secret").send({ discordUserId: "" });
});

test("forgot-password is admin-only now — even a fully verified Lord can't use it", async () => {
  mockNetwork({
    discordTokens: { "good-token": { userId: "user-1", roles: ["role-stark-lord"] } },
    robloxTokens: { "good-roblox-token": { userId: "12345", username: "WinterfellKing" } }
  });

  const asLord = await request
    .post("/api/houses/stark/forgot-password")
    .set("Authorization", "Bearer good-token")
    .set("X-Roblox-Token", "good-roblox-token");
  assert.equal(asLord.status, 401);

  const asAdmin = await request.post("/api/houses/stark/forgot-password").set("x-admin-secret", "test-secret");
  assert.equal(asAdmin.status, 200);

  const check = await request.get("/api/houses/stark");
  assert.equal(check.body.locked, false);
});

test("a Discord account listed in OWNER_DISCORD_USER_IDS gets full owner access with no secret at all", async () => {
  process.env.OWNER_DISCORD_USER_IDS = "owner-discord-id-1, owner-discord-id-2";
  mockNetwork({
    discordTokens: {
      "owner-token": { userId: "owner-discord-id-1", username: "TheRealOwner" },
      "regular-token": { userId: "some-other-user", username: "JustSomeone" }
    }
  });

  try {
    const noToken = await request.get("/api/admin/houses");
    assert.equal(noToken.status, 401);

    const notAnOwner = await request.get("/api/admin/houses").set("Authorization", "Bearer regular-token");
    assert.equal(notAnOwner.status, 401);

    const whoami = await request.get("/api/admin/whoami").set("Authorization", "Bearer owner-token");
    assert.equal(whoami.status, 200);
    assert.equal(whoami.body.role, "owner");
    assert.equal(whoami.body.name, "TheRealOwner");

    const houses = await request.get("/api/admin/houses").set("Authorization", "Bearer owner-token");
    assert.equal(houses.status, 200);

    // owner-only actions work too, no admin secret required
    const staffList = await request.get("/api/admin/staff").set("Authorization", "Bearer owner-token");
    assert.equal(staffList.status, 200);

    // and so do the older house-level owner actions that predate Discord-owner
    // login (these used to only accept the raw ADMIN_SECRET)
    const reset = await request
      .post("/api/admin/houses/tully/reset-password")
      .set("Authorization", "Bearer owner-token")
      .send({ password: "newpass" });
    assert.equal(reset.status, 200);

    const forgot = await request.post("/api/houses/tully/forgot-password").set("Authorization", "Bearer owner-token");
    assert.equal(forgot.status, 200);
  } finally {
    delete process.env.OWNER_DISCORD_USER_IDS;
  }
});

test("signing in with Discord records the account, searchable by username — but only after they've actually signed in", async () => {
  const notYetSeen = await request.get("/api/admin/discord-users?q=WinterfellKing").set("x-admin-secret", "test-secret");
  assert.equal(notYetSeen.status, 200);
  assert.deepEqual(notYetSeen.body, []);

  // GET /api/votes always verifies the Discord token, regardless of any
  // house's lock state — unlike /api/houses/:slug, which only verifies at
  // all while that specific house is locked (and other tests in this file
  // unlock/relock houses, so relying on one of those would be fragile).
  mockNetwork({ discordTokens: { "seen-token": { userId: "seen-user-1", username: "WinterfellKing" } } });
  const check = await request.get("/api/votes").set("Authorization", "Bearer seen-token");
  assert.equal(check.status, 200);

  const noSecret = await request.get("/api/admin/discord-users?q=winter");
  assert.equal(noSecret.status, 401);

  const noMatch = await request.get("/api/admin/discord-users?q=NoSuchPerson").set("x-admin-secret", "test-secret");
  assert.deepEqual(noMatch.body, []);

  // Case-insensitive substring match.
  const match = await request.get("/api/admin/discord-users?q=winter").set("x-admin-secret", "test-secret");
  assert.equal(match.status, 200);
  assert.equal(match.body.length, 1);
  assert.equal(match.body[0].id, "seen-user-1");
  assert.equal(match.body[0].username, "WinterfellKing");

  // Signing in again with a changed username updates the record in place, not a second row.
  mockNetwork({ discordTokens: { "seen-token-2": { userId: "seen-user-1", username: "WinterfellKing2" } } });
  await request.get("/api/votes").set("Authorization", "Bearer seen-token-2");
  const renamed = await request.get("/api/admin/discord-users?q=WinterfellKing2").set("x-admin-secret", "test-secret");
  assert.equal(renamed.body.length, 1);
  assert.equal(renamed.body[0].username, "WinterfellKing2");

  // Empty query returns recently-seen accounts rather than nothing.
  const browse = await request.get("/api/admin/discord-users").set("x-admin-secret", "test-secret");
  assert.equal(browse.status, 200);
  assert.ok(browse.body.some((u) => u.id === "seen-user-1"));
});
