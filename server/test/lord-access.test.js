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

// Mocks the two Discord API calls server/discord.js makes, without touching
// the real network: identify the visitor's OAuth token, then look up that
// (now-verified) user's roles via the bot token.
const realFetch = global.fetch;
function mockDiscordFetch(tokenMap) {
  // tokenMap: { [visitorOAuthToken]: { userId, roles } }
  global.fetch = async (url, opts) => {
    const authHeader = (opts && opts.headers && opts.headers.Authorization) || "";
    if (String(url) === "https://discord.com/api/users/@me") {
      const entry = tokenMap[authHeader.replace("Bearer ", "")];
      if (!entry) return { ok: false, status: 401 };
      return { ok: true, json: async () => ({ id: entry.userId }) };
    }
    if (String(url).includes("/guilds/") && String(url).includes("/members/")) {
      assert.equal(authHeader, `Bot ${process.env.DISCORD_BOT_TOKEN}`);
      const userId = String(url).split("/members/")[1];
      const entry = Object.values(tokenMap).find((e) => e.userId === userId);
      if (!entry) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ roles: entry.roles }) };
    }
    return realFetch(url, opts);
  };
}

test.after(() => {
  global.fetch = realFetch;
});

test("assigning a lord role requires the admin secret", async () => {
  const noAuth = await request.post("/api/houses/stark/lord-role").send({ roleId: "role-stark-lord" });
  assert.equal(noAuth.status, 401);

  const res = await request
    .post("/api/houses/stark/lord-role")
    .set("x-admin-secret", "test-secret")
    .send({ roleId: "role-stark-lord" });
  assert.equal(res.status, 200);
});

test("without a token, the house still looks locked to everyone", async () => {
  const res = await request.get("/api/houses/stark");
  assert.equal(res.body.locked, true);
  assert.equal(res.body.members, undefined);
  assert.equal(res.body.lordAccess, undefined);
});

test("a user holding the assigned Discord role can view and edit the locked house without its password", async () => {
  mockDiscordFetch({ "good-token": { userId: "user-1", roles: ["role-stark-lord", "some-other-role"] } });

  const withToken = await request.get("/api/houses/stark").set("Authorization", "Bearer good-token");
  assert.equal(withToken.body.locked, true);
  assert.equal(withToken.body.lordAccess, true);
  assert.ok(Array.isArray(withToken.body.members));

  const add = await request
    .post("/api/houses/stark/members")
    .set("Authorization", "Bearer good-token")
    .send({ name: "Lord-Added Member" });
  assert.equal(add.status, 201);
});

test("a user without the assigned role cannot edit the locked house", async () => {
  mockDiscordFetch({ "bad-token": { userId: "user-2", roles: ["some-unrelated-role"] } });

  const res = await request
    .post("/api/houses/stark/members")
    .set("Authorization", "Bearer bad-token")
    .send({ name: "Should Fail" });
  assert.equal(res.status, 403);
});

test("an invalid/expired OAuth token (fails identity check) is treated as no access", async () => {
  mockDiscordFetch({}); // no tokens recognized by /users/@me
  const res = await request.get("/api/houses/stark").set("Authorization", "Bearer garbage-token");
  assert.equal(res.body.locked, true);
  assert.equal(res.body.lordAccess, undefined);
});

test("forgot-password works for the house's Lord too, not just the site admin", async () => {
  mockDiscordFetch({ "good-token": { userId: "user-1", roles: ["role-stark-lord"] } });
  const res = await request.post("/api/houses/stark/forgot-password").set("Authorization", "Bearer good-token");
  assert.equal(res.status, 200);

  const check = await request.get("/api/houses/stark");
  assert.equal(check.body.locked, false);
});
