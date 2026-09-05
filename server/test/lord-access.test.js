const test = require("node:test");
const assert = require("node:assert");
process.env.ADMIN_SECRET = "test-secret";
process.env.DISCORD_GUILD_ID = "guild-123";

const { setupTestDb } = require("../db-test-utils");
const memPool = setupTestDb();
const { seed } = require("../seed");
const app = require("../app");
const request = require("supertest")(app);

test.before(async () => {
  await seed(memPool);
});

// Mock the global fetch used by server/discord.js, without touching real network calls.
const realFetch = global.fetch;
function mockDiscordFetch(rolesByToken) {
  global.fetch = async (url, opts) => {
    if (String(url).includes("discord.com/api/users/@me/guilds/")) {
      const token = ((opts && opts.headers && opts.headers.Authorization) || "").replace("Bearer ", "");
      const roles = rolesByToken[token];
      if (roles === undefined) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ roles }) };
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
  mockDiscordFetch({ "good-token": ["role-stark-lord", "some-other-role"] });

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
  mockDiscordFetch({ "bad-token": ["some-unrelated-role"] });

  const res = await request
    .post("/api/houses/stark/members")
    .set("Authorization", "Bearer bad-token")
    .send({ name: "Should Fail" });
  assert.equal(res.status, 403);
});

test("forgot-password works for the house's Lord too, not just the site admin", async () => {
  mockDiscordFetch({ "good-token": ["role-stark-lord"] });
  const res = await request.post("/api/houses/stark/forgot-password").set("Authorization", "Bearer good-token");
  assert.equal(res.status, 200);

  const check = await request.get("/api/houses/stark");
  assert.equal(check.body.locked, false);
});
