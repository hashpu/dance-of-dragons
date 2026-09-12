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
  assert.equal(approve.body.dmSent, false); // nobody signed in with Discord when they applied — nothing to DM

  const after = await request.get("/api/applications").set("x-admin-secret", "test-secret");
  assert.equal(after.body.find((a) => a.id === id).status, "approved");
});

test("POST /api/applications/:id/decline requires the admin secret and a reason, and stores it", async () => {
  const created = await request
    .post("/api/applications")
    .field("department", "lore")
    .field("robloxUsername", "ToDecline")
    .field("discordUsername", "todecline")
    .field("why", "Testing decline")
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
  const id = created.body.id;

  const noAuth = await request.post(`/api/applications/${id}/decline`).send({ reason: "Not a fit right now" });
  assert.equal(noAuth.status, 401);

  const noReason = await request.post(`/api/applications/${id}/decline`).set("x-admin-secret", "test-secret").send({});
  assert.equal(noReason.status, 400);

  const missing = await request
    .post("/api/applications/999999/decline")
    .set("x-admin-secret", "test-secret")
    .send({ reason: "N/A" });
  assert.equal(missing.status, 404);

  const declined = await request
    .post(`/api/applications/${id}/decline`)
    .set("x-admin-secret", "test-secret")
    .send({ reason: "Not a fit right now" });
  assert.equal(declined.status, 200);
  assert.equal(declined.body.status, "declined");
  assert.equal(declined.body.declineReason, "Not a fit right now");
  assert.equal(declined.body.dmSent, false); // nobody signed in with Discord when they applied

  const after = await request.get("/api/applications").set("x-admin-secret", "test-secret");
  const row = after.body.find((a) => a.id === id);
  assert.equal(row.status, "declined");
  assert.equal(row.decline_reason, "Not a fit right now");
});

test("an applicant signed in with Discord when they applied gets DMed and can see/dismiss the decision via /mine and /seen", async () => {
  const realFetch = global.fetch;
  process.env.DISCORD_BOT_TOKEN = "test-bot-token";
  global.fetch = async (url, opts) => {
    const urlStr = String(url);
    const authHeader = (opts && opts.headers && opts.headers.Authorization) || "";
    if (urlStr === "https://discord.com/api/users/@me") {
      const token = authHeader.replace("Bearer ", "");
      if (token === "applicant-token") return { ok: true, json: async () => ({ id: "applicant-1", username: "Applicant" }) };
      if (token === "other-applicant-token") return { ok: true, json: async () => ({ id: "applicant-2", username: "Other" }) };
      return { ok: false, status: 401 };
    }
    if (urlStr === "https://discord.com/api/v10/users/@me/channels") {
      return { ok: true, json: async () => ({ id: "dm-channel-1" }) };
    }
    if (urlStr === "https://discord.com/api/v10/channels/dm-channel-1/messages") {
      return { ok: true, json: async () => ({}) };
    }
    return realFetch(url, opts);
  };

  try {
    const noneYet = await request.get("/api/applications/mine").set("Authorization", "Bearer applicant-token");
    assert.deepEqual(noneYet.body, []);

    const notSignedIn = await request.get("/api/applications/mine");
    assert.deepEqual(notSignedIn.body, []);

    const created = await request
      .post("/api/applications")
      .set("Authorization", "Bearer applicant-token")
      .field("department", "lore")
      .field("robloxUsername", "SignedInApplicant")
      .field("discordUsername", "whatever-they-typed")
      .field("why", "Testing DM + inbox notify")
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

    // still pending — /mine only ever shows decided applications
    const pendingMine = await request.get("/api/applications/mine").set("Authorization", "Bearer applicant-token");
    assert.deepEqual(pendingMine.body, []);

    const declined = await request
      .post(`/api/applications/${id}/decline`)
      .set("x-admin-secret", "test-secret")
      .send({ reason: "Please reapply once you have more availability" });
    assert.equal(declined.status, 200);
    assert.equal(declined.body.dmSent, true);

    const mine = await request.get("/api/applications/mine").set("Authorization", "Bearer applicant-token");
    assert.equal(mine.status, 200);
    assert.equal(mine.body.length, 1);
    assert.equal(mine.body[0].id, id);
    assert.equal(mine.body[0].status, "declined");
    assert.equal(mine.body[0].declineReason, "Please reapply once you have more availability");
    assert.equal(mine.body[0].departmentName, "Lore Department");
    assert.equal(mine.body[0].seen, false);

    // ownership is enforced — a different signed-in account can't dismiss it
    const wrongOwner = await request.post(`/api/applications/${id}/seen`).set("Authorization", "Bearer other-applicant-token");
    assert.equal(wrongOwner.status, 404);

    const noToken = await request.post(`/api/applications/${id}/seen`);
    assert.equal(noToken.status, 401);

    const seen = await request.post(`/api/applications/${id}/seen`).set("Authorization", "Bearer applicant-token");
    assert.equal(seen.status, 200);

    const mineAfterSeen = await request.get("/api/applications/mine").set("Authorization", "Bearer applicant-token");
    assert.equal(mineAfterSeen.body[0].seen, true);
  } finally {
    global.fetch = realFetch;
    delete process.env.DISCORD_BOT_TOKEN;
  }
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
