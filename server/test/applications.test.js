const test = require("node:test");
const assert = require("node:assert");
process.env.ADMIN_SECRET = "test-secret";

const { setupTestDb } = require("../db-test-utils");
setupTestDb();
const app = require("../app");
const request = require("supertest")(app);

// Submitting an application now requires being signed in with Discord (see
// POST /api/applications) — this one generic identity covers every test
// below that doesn't care WHO the applicant is (field validation, the
// admin approve/decline/delete plumbing), so they don't each need their
// own bespoke fetch mock just to get past that gate. Tests that DO care
// about a specific applicant identity (DM delivery, /mine, ownership
// checks) install their own more detailed mock and restore this one
// afterward via realFetch in a finally block.
const REAL_FETCH = global.fetch;
const GENERIC_APPLICANT_TOKEN = "generic-applicant-token";
global.fetch = async (url, opts) => {
  const urlStr = String(url);
  const authHeader = (opts && opts.headers && opts.headers.Authorization) || "";
  if (urlStr === "https://discord.com/api/users/@me") {
    if (authHeader.replace("Bearer ", "") === GENERIC_APPLICANT_TOKEN) {
      return { ok: true, json: async () => ({ id: "generic-applicant-id", username: "GenericApplicant" }) };
    }
    return { ok: false, status: 401 };
  }
  return REAL_FETCH(url, opts);
};

test("rejects an application submitted without signing in with Discord first", async () => {
  const res = await request.post("/api/applications").send({
    department: "lore",
    robloxUsername: "Tester",
    why: "Because",
    answers: JSON.stringify({})
  });
  assert.equal(res.status, 401);
});

test("rejects an application missing required fields", async () => {
  const res = await request
    .post("/api/applications")
    .set("Authorization", `Bearer ${GENERIC_APPLICANT_TOKEN}`)
    .send({
      department: "lore",
      robloxUsername: "Tester",
      why: "Because",
      answers: JSON.stringify({})
    });
  assert.equal(res.status, 400);
});

test("accepts a complete application and stores it", async () => {
  const res = await request
    .post("/api/applications")
    .set("Authorization", `Bearer ${GENERIC_APPLICANT_TOKEN}`)
    .field("department", "lore")
    .field("robloxUsername", "Tester")
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
    .set("Authorization", `Bearer ${GENERIC_APPLICANT_TOKEN}`)
    .field("department", "lore")
    .field("robloxUsername", "ToDelete")
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
    .set("Authorization", `Bearer ${GENERIC_APPLICANT_TOKEN}`)
    .field("department", "lore")
    .field("robloxUsername", "ToApprove")
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
  assert.equal(approve.body.dmSent, false); // no DISCORD_BOT_TOKEN configured in this test — nothing to DM through

  const after = await request.get("/api/applications").set("x-admin-secret", "test-secret");
  assert.equal(after.body.find((a) => a.id === id).status, "approved");
});

test("POST /api/applications/:id/decline requires the admin secret and a reason, and stores it", async () => {
  const created = await request
    .post("/api/applications")
    .set("Authorization", `Bearer ${GENERIC_APPLICANT_TOKEN}`)
    .field("department", "lore")
    .field("robloxUsername", "ToDecline")
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
  assert.equal(declined.body.dmSent, false); // no DISCORD_BOT_TOKEN configured in this test — nothing to DM through

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

test("an admin can message an applicant on a still-pending application, and they can see/dismiss it via /mine", async () => {
  const realFetch = global.fetch;
  process.env.DISCORD_BOT_TOKEN = "test-bot-token";
  global.fetch = async (url, opts) => {
    const urlStr = String(url);
    const authHeader = (opts && opts.headers && opts.headers.Authorization) || "";
    if (urlStr === "https://discord.com/api/users/@me") {
      const token = authHeader.replace("Bearer ", "");
      if (token === "msg-applicant-token") return { ok: true, json: async () => ({ id: "msg-applicant-1", username: "MsgApplicant" }) };
      if (token === "msg-other-token") return { ok: true, json: async () => ({ id: "msg-applicant-2", username: "Other" }) };
      return { ok: false, status: 401 };
    }
    if (urlStr === "https://discord.com/api/v10/users/@me/channels") {
      return { ok: true, json: async () => ({ id: "dm-channel-2" }) };
    }
    if (urlStr === "https://discord.com/api/v10/channels/dm-channel-2/messages") {
      return { ok: true, json: async () => ({}) };
    }
    return realFetch(url, opts);
  };

  try {
    const created = await request
      .post("/api/applications")
      .set("Authorization", "Bearer msg-applicant-token")
      .field("department", "lore")
      .field("robloxUsername", "MsgApplicantRblx")
      .field("why", "Testing messages")
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

    const empty = await request.post(`/api/applications/${id}/message`).set("x-admin-secret", "test-secret").send({ message: "" });
    assert.equal(empty.status, 400);

    const noSecret = await request.post(`/api/applications/${id}/message`).send({ message: "hi" });
    assert.equal(noSecret.status, 401);

    const sent = await request
      .post(`/api/applications/${id}/message`)
      .set("x-admin-secret", "test-secret")
      .send({ message: "Can you clarify your availability?" });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.dmSent, true);
    const messageId = sent.body.message.id;

    // Shows up even though the application itself is still pending — a
    // message is independent of a decision.
    const mine = await request.get("/api/applications/mine").set("Authorization", "Bearer msg-applicant-token");
    assert.equal(mine.status, 200);
    assert.equal(mine.body.length, 1);
    assert.equal(mine.body[0].type, "message");
    assert.equal(mine.body[0].body, "Can you clarify your availability?");
    assert.equal(mine.body[0].seen, false);

    const list = await request.get("/api/applications").set("x-admin-secret", "test-secret");
    const found = list.body.find((a) => a.id === id);
    assert.equal(found.messages.length, 1);
    assert.equal(found.messages[0].body, "Can you clarify your availability?");

    // Ownership is enforced the same way as /:id/seen.
    const wrongOwner = await request.post(`/api/applications/messages/${messageId}/seen`).set("Authorization", "Bearer msg-other-token");
    assert.equal(wrongOwner.status, 404);

    const dismissed = await request
      .post(`/api/applications/messages/${messageId}/seen`)
      .set("Authorization", "Bearer msg-applicant-token");
    assert.equal(dismissed.status, 200);

    const mineAfter = await request.get("/api/applications/mine").set("Authorization", "Bearer msg-applicant-token");
    assert.equal(mineAfter.body[0].seen, true);
  } finally {
    global.fetch = realFetch;
    delete process.env.DISCORD_BOT_TOKEN;
  }
});

test("rejects an unknown department", async () => {
  const res = await request
    .post("/api/applications")
    .set("Authorization", `Bearer ${GENERIC_APPLICANT_TOKEN}`)
    .field("department", "not-a-real-department")
    .field("robloxUsername", "Tester")
    .field("why", "Because");
  assert.equal(res.status, 400);
});
