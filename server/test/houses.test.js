const test = require("node:test");
const assert = require("node:assert");
process.env.ADMIN_SECRET = "test-secret";

const { setupTestDb } = require("../db-test-utils");
const memPool = setupTestDb();
const { seed } = require("../seed");
const app = require("../app");
const request = require("supertest")(app);

test.before(async () => {
  await seed(memPool);
});

test("GET /api/houses lists all houses with correct member counts, in order", async () => {
  const res = await request.get("/api/houses");
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 10);
  assert.equal(res.body[0].slug, "targaryen");
  assert.equal(res.body[0].memberCount, 5);
  assert.equal(res.body[1].slug, "velaryon");
  assert.equal(res.body[1].memberCount, 3);
  assert.equal(res.body[1].locked, true);
  assert.equal(res.body[2].memberCount, 0);
});

test("GET /api/houses/:slug hides members while locked, then unlocking reveals them", async () => {
  const before = await request.get("/api/houses/targaryen");
  assert.equal(before.status, 200);
  assert.equal(before.body.locked, true);
  assert.equal(before.body.members, undefined);

  const unlocked = await request.post("/api/houses/targaryen/unlock").send({ password: "dracarys" });
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.body.locked, false);
  assert.equal(unlocked.body.members.length, 5);
  const rhaenyra = unlocked.body.members.find((m) => m.id === "rhaenyra");
  assert.equal(rhaenyra.parentId, "viserys-i");
  assert.equal(rhaenyra.role, "Heir");

  // shared state: a plain GET now also sees it unlocked (targaryen stays unlocked for later tests in this file)
  const after = await request.get("/api/houses/targaryen");
  assert.equal(after.body.locked, false);
  assert.equal(after.body.members.length, 5);
});

test("GET /api/houses/:slug hides members while locked", async () => {
  const res = await request.get("/api/houses/velaryon");
  assert.equal(res.status, 200);
  assert.equal(res.body.locked, true);
  assert.equal(res.body.members, undefined);
});

test("unlocking with the wrong password fails", async () => {
  const res = await request.post("/api/houses/velaryon/unlock").send({ password: "nope" });
  assert.equal(res.status, 401);
});

test("unlocking with the correct password succeeds and is shared", async () => {
  const res = await request.post("/api/houses/velaryon/unlock").send({ password: "driftmark" });
  assert.equal(res.status, 200);
  assert.equal(res.body.locked, false);
  assert.equal(res.body.members.length, 3);

  // shared state: a plain GET now also sees it unlocked, no password needed
  const res2 = await request.get("/api/houses/velaryon");
  assert.equal(res2.body.locked, false);
  assert.equal(res2.body.members.length, 3);
});

test("adding, editing, and reparent-loop protection on members", async () => {
  const add = await request.post("/api/houses/targaryen/members").send({
    name: "Baela Targaryen",
    role: "",
    parentId: "rhaenyra"
  });
  assert.equal(add.status, 201);
  const newId = add.body.id;
  assert.ok(newId);
  assert.equal(add.body.parentId, "rhaenyra");

  const edit = await request.patch(`/api/houses/targaryen/members/${newId}`).send({
    name: "Baela Targaryen",
    role: "Rider of Moondancer",
    parentId: "rhaenyra"
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.role, "Rider of Moondancer");

  // rhaenyra can't become a child of her own new descendant (baela)
  const loop = await request.patch("/api/houses/targaryen/members/rhaenyra").send({
    name: "Rhaenyra",
    role: "Heir",
    parentId: newId
  });
  assert.equal(loop.status, 400);
});

test("deleting a member cascades to descendants and reports the count", async () => {
  // rhaenyra has children jacaerys and (from the previous test) baela
  const del = await request.delete("/api/houses/targaryen/members/rhaenyra");
  assert.equal(del.status, 200);
  assert.equal(del.body.removedCount, 3); // rhaenyra + jacaerys + baela

  const check = await request.get("/api/houses/targaryen");
  const ids = check.body.members.map((m) => m.id);
  assert.ok(!ids.includes("rhaenyra"));
  assert.ok(!ids.includes("jacaerys"));
});

test("forgot-password requires the admin secret and clears the lock/password entirely", async () => {
  const noAuth = await request.post("/api/houses/hightower/forgot-password");
  assert.equal(noAuth.status, 401);

  const res = await request.post("/api/houses/hightower/forgot-password").set("x-admin-secret", "test-secret");
  assert.equal(res.status, 200);
  const check = await request.get("/api/houses/hightower");
  assert.equal(check.body.locked, false);
});

test("locking a house for the first time requires a password, then works, then blocks writes", async () => {
  // hightower's password was cleared by the previous test, so this exercises the "first lock" path
  const noPassword = await request.post("/api/houses/hightower/lock").send({});
  assert.equal(noPassword.status, 400);

  const locked = await request.post("/api/houses/hightower/lock").send({ password: "oldtown" });
  assert.equal(locked.status, 200);

  const blocked = await request.post("/api/houses/hightower/members").send({ name: "Otto Hightower" });
  assert.equal(blocked.status, 403);
});

test("admin reset requires the correct secret and restores default data", async () => {
  const noAuth = await request.post("/api/admin/reset");
  assert.equal(noAuth.status, 401);

  const withAuth = await request.post("/api/admin/reset").set("x-admin-secret", "test-secret");
  assert.equal(withAuth.status, 200);

  const check = await request.get("/api/houses/targaryen");
  assert.equal(check.body.locked, true); // back to the original seed (all houses start locked)

  const unlocked = await request.post("/api/houses/targaryen/unlock").send({ password: "dracarys" });
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.body.members.length, 5);
});
