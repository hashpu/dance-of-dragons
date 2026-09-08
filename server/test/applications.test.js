const test = require("node:test");
const assert = require("node:assert");
process.env.ADMIN_SECRET = "test-secret";

const { setupTestDb } = require("../db-test-utils");
setupTestDb();
const app = require("../app");
const request = require("supertest")(app);

test("rejects an application missing required fields", async () => {
  const res = await request.post("/api/applications").send({
    department: "lore",
    robloxUsername: "Tester",
    discordUsername: "tester",
    why: "Because",
    answers: JSON.stringify({})
  });
  assert.equal(res.status, 400);
});

test("accepts a complete application and stores it", async () => {
  const res = await request
    .post("/api/applications")
    .field("department", "lore")
    .field("robloxUsername", "Tester")
    .field("discordUsername", "tester")
    .field("availability", "5hrs/week")
    .field("why", "I love writing lore")
    .field(
      "answers",
      JSON.stringify({
        discordId: "123456789012345678",
        robloxProfile: "https://www.roblox.com/users/1/profile",
        experience: "Wrote lore for a few Roblox groups before.",
        readBooks: "Yes, all five published novels.",
        viserysQuestion: "He'd promised the lords his word as king, and undoing it risked civil war either way.",
        dorneQuestion: "Guerrilla tactics and the desert terrain made a direct conquest too costly.",
        northQuestion: "It's the largest, most defensible region and its lords rarely commit lightly.",
        acDescription: "129 AC: King Viserys I dies, and the succession crisis begins.",
        creativeStory: "House Testwell..."
      })
    );

  assert.equal(res.status, 201);
  assert.ok(res.body.id);

  const list = await request.get("/api/applications").set("x-admin-secret", "test-secret");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].department, "lore");
});

test("GET /api/applications requires the admin secret", async () => {
  const res = await request.get("/api/applications");
  assert.equal(res.status, 401);
});

test("rejects an unknown department", async () => {
  const res = await request
    .post("/api/applications")
    .field("department", "not-a-real-department")
    .field("robloxUsername", "Tester")
    .field("discordUsername", "tester")
    .field("why", "Because");
  assert.equal(res.status, 400);
});
