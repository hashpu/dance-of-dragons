const test = require("node:test");
const assert = require("node:assert");
process.env.ADMIN_SECRET = "test-secret";

const { setupTestDb } = require("../db-test-utils");
setupTestDb();
const app = require("../app");
const request = require("supertest")(app);

const REAL_FETCH = global.fetch;
const APPLICANT_TOKEN = "dept-lock-applicant-token";
global.fetch = async (url, opts) => {
  const urlStr = String(url);
  const authHeader = (opts && opts.headers && opts.headers.Authorization) || "";
  if (urlStr === "https://discord.com/api/users/@me") {
    if (authHeader.replace("Bearer ", "") === APPLICANT_TOKEN) {
      return { ok: true, json: async () => ({ id: "dept-lock-applicant", username: "DeptLockApplicant" }) };
    }
    return { ok: false, status: 401 };
  }
  return REAL_FETCH(url, opts);
};

function submitLoreApplication(robloxUsername) {
  return request
    .post("/api/applications")
    .set("Authorization", `Bearer ${APPLICANT_TOKEN}`)
    .field("department", "lore")
    .field("robloxUsername", robloxUsername)
    .field("why", "Testing department locks")
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
}

test("GET /api/applications/closed-departments starts empty", async () => {
  const res = await request.get("/api/applications/closed-departments");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test("POST /api/admin/departments/:key/close requires the admin secret", async () => {
  const res = await request.post("/api/admin/departments/lore/close");
  assert.equal(res.status, 401);
});

test("closing an unknown department is rejected", async () => {
  const res = await request.post("/api/admin/departments/not-a-real-department/close").set("x-admin-secret", "test-secret");
  assert.equal(res.status, 404);
});

test("closing a department blocks new submissions and shows up publicly, until it's reopened", async () => {
  const before = await submitLoreApplication("BeforeClose");
  assert.equal(before.status, 201);

  const close = await request.post("/api/admin/departments/lore/close").set("x-admin-secret", "test-secret");
  assert.equal(close.status, 200);

  const closedList = await request.get("/api/applications/closed-departments");
  assert.deepEqual(closedList.body, ["lore"]);

  const whileClosed = await submitLoreApplication("WhileClosed");
  assert.equal(whileClosed.status, 403);

  // closing again is a no-op, not an error
  const closeAgain = await request.post("/api/admin/departments/lore/close").set("x-admin-secret", "test-secret");
  assert.equal(closeAgain.status, 200);

  const open = await request.post("/api/admin/departments/lore/open").set("x-admin-secret", "test-secret");
  assert.equal(open.status, 200);

  const reopenedList = await request.get("/api/applications/closed-departments");
  assert.deepEqual(reopenedList.body, []);

  const afterOpen = await submitLoreApplication("AfterOpen");
  assert.equal(afterOpen.status, 201);
});

test("opening a department that was never closed is a no-op, not an error", async () => {
  const res = await request.post("/api/admin/departments/warfare/open").set("x-admin-secret", "test-secret");
  assert.equal(res.status, 200);
});

test("GET /api/admin/departments/closed requires the admin secret and reports when each one was closed", async () => {
  const noAuth = await request.get("/api/admin/departments/closed");
  assert.equal(noAuth.status, 401);

  const empty = await request.get("/api/admin/departments/closed").set("x-admin-secret", "test-secret");
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, []);

  await request.post("/api/admin/departments/media/close").set("x-admin-secret", "test-secret");

  const withOne = await request.get("/api/admin/departments/closed").set("x-admin-secret", "test-secret");
  assert.equal(withOne.status, 200);
  assert.equal(withOne.body.length, 1);
  assert.equal(withOne.body[0].department, "media");
  assert.ok(withOne.body[0].closedAt);

  // the public list stays a plain key array — admin.js's detailed endpoint
  // above is additive, not a replacement for it.
  const publicList = await request.get("/api/applications/closed-departments");
  assert.deepEqual(publicList.body, ["media"]);

  await request.post("/api/admin/departments/media/open").set("x-admin-secret", "test-secret");
});
