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

test("DELETE /api/applications/:id requires the admin secret and removes just that ticket", async () => {
  const created = await request
    .post("/api/applications")
    .field("department", "lore")
    .field("robloxUsername", "ToDelete")
    .field("discordUsername", "todelete")
    .field("why", "Testing deletion")
    .field(
      "answers",
      JSON.stringify({
        experience: "N/A",
        readBooks: "N/A",
        viserysQuestion: "N/A",
        dorneQuestion: "N/A",
        northQuestion: "N/A",
        acDescription: "N/A",
        creativeStory: "N/A"
      })
    );
  assert.equal(created.status, 201);
  const id = created.body.id;

  const noAuth = await request.delete(`/api/applications/${id}`);
  assert.equal(noAuth.status, 401);

  const missing = await request.delete("/api/applications/999999").set("x-admin-secret", "test-secret");
  assert.equal(missing.status, 404);

  const del = await request.delete(`/api/applications/${id}`).set("x-admin-secret", "test-secret");
  assert.equal(del.status, 200);

  const list = await request.get("/api/applications").set("x-admin-secret", "test-secret");
  assert.ok(!list.body.some((a) => a.id === id));
});

test("POST /api/applications/:id/approve requires the admin secret and marks just that ticket approved", async () => {
  const created = await request
    .post("/api/applications")
    .field("department", "lore")
    .field("robloxUsername", "ToApprove")
    .field("discordUsername", "toapprove")
    .field("why", "Testing approval")
    .field(
      "answers",
      JSON.stringify({
        experience: "N/A",
        readBooks: "N/A",
        viserysQuestion: "N/A",
        dorneQuestion: "N/A",
        northQuestion: "N/A",
        acDescription: "N/A",
        creativeStory: "N/A"
      })
    );
  assert.equal(created.status, 201);
  const id = created.body.id;

  const list = await request.get("/api/applications").set("x-admin-secret", "test-secret");
  assert.equal(list.body.find((a) => a.id === id).status, "pending");

  const noAuth = await request.post(`/api/applications/${id}/approve`);
  assert.equal(noAuth.status, 401);

  const missing = await request.post("/api/applications/999999/approve").set("x-admin-secret", "test-secret");
  assert.equal(missing.status, 404);

  const approve = await request.post(`/api/applications/${id}/approve`).set("x-admin-secret", "test-secret");
  assert.equal(approve.status, 200);
  assert.equal(approve.body.status, "approved");

  const after = await request.get("/api/applications").set("x-admin-secret", "test-secret");
  assert.equal(after.body.find((a) => a.id === id).status, "approved");
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
