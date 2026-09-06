const test = require("node:test");
const assert = require("node:assert");

const { setupTestDb } = require("../db-test-utils");
setupTestDb();
const app = require("../app");
const request = require("supertest")(app);

const realFetch = global.fetch;
function mockDiscordIdentify(tokens) {
  global.fetch = async (url, opts) => {
    if (String(url) === "https://discord.com/api/users/@me") {
      const auth = (opts && opts.headers && opts.headers.Authorization) || "";
      const userId = tokens[auth.replace("Bearer ", "")];
      if (!userId) return { ok: false, status: 401 };
      return { ok: true, json: async () => ({ id: userId }) };
    }
    return realFetch(url, opts);
  };
}
test.after(() => {
  global.fetch = realFetch;
});

test("voting requires being signed in with Discord", async () => {
  mockDiscordIdentify({});
  const res = await request.post("/api/votes").send({ choice: "green" });
  assert.equal(res.status, 401);
});

test("rejects a choice that isn't green or black", async () => {
  mockDiscordIdentify({ "good-token": "user-1" });
  const res = await request.post("/api/votes").set("Authorization", "Bearer good-token").send({ choice: "purple" });
  assert.equal(res.status, 400);
});

test("a vote is tallied, and the tally reflects the caller's own vote", async () => {
  mockDiscordIdentify({ "user-a-token": "user-a", "user-b-token": "user-b" });

  const before = await request.get("/api/votes");
  assert.equal(before.body.total, 0);
  assert.equal(before.body.myVote, null);

  const voteA = await request.post("/api/votes").set("Authorization", "Bearer user-a-token").send({ choice: "green" });
  assert.equal(voteA.status, 200);
  const voteB = await request.post("/api/votes").set("Authorization", "Bearer user-b-token").send({ choice: "black" });
  assert.equal(voteB.status, 200);

  const tally = await request.get("/api/votes");
  assert.equal(tally.body.green, 1);
  assert.equal(tally.body.black, 1);
  assert.equal(tally.body.total, 2);

  const asUserA = await request.get("/api/votes").set("Authorization", "Bearer user-a-token");
  assert.equal(asUserA.body.myVote, "green");
});

test("voting again changes your pick instead of adding a second vote", async () => {
  mockDiscordIdentify({ "switcher-token": "user-switcher" });

  await request.post("/api/votes").set("Authorization", "Bearer switcher-token").send({ choice: "green" });
  const afterFirst = await request.get("/api/votes");
  const totalAfterFirst = afterFirst.body.total;

  await request.post("/api/votes").set("Authorization", "Bearer switcher-token").send({ choice: "black" });
  const afterSecond = await request.get("/api/votes");

  assert.equal(afterSecond.body.total, totalAfterFirst); // no new row, just changed
  const asSwitcher = await request.get("/api/votes").set("Authorization", "Bearer switcher-token");
  assert.equal(asSwitcher.body.myVote, "black");
});
