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
  assert.equal(res.body.length, 26);
  assert.equal(res.body[0].slug, "targaryen");
  assert.equal(res.body[0].memberCount, 5);
  assert.equal(res.body[1].slug, "velaryon");
  assert.equal(res.body[1].memberCount, 3);
  assert.equal(res.body[1].locked, true);
  assert.equal(res.body[2].memberCount, 0);
});

test("GET /api/houses/:slug hides members while locked, then unlocking reveals them for that response only", async () => {
  const before = await request.get("/api/houses/targaryen");
  assert.equal(before.status, 200);
  assert.equal(before.body.locked, true);
  assert.equal(before.body.members, undefined);

  const unlocked = await request.post("/api/houses/targaryen/unlock").send({ password: "dracarys" });
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.body.locked, true); // unlocking never persists — the house stays locked in the database
  assert.equal(unlocked.body.members.length, 5);
  const rhaenyra = unlocked.body.members.find((m) => m.id === "rhaenyra");
  assert.equal(rhaenyra.parentId, "viserys-i");
  assert.equal(rhaenyra.role, "Heir");

  // not shared: a plain GET with no password immediately after is locked again, for everyone
  const after = await request.get("/api/houses/targaryen");
  assert.equal(after.body.locked, true);
  assert.equal(after.body.members, undefined);

  // but sending the password again (as the client does while it's held in page memory) still works
  const withPassword = await request.get("/api/houses/targaryen").set("x-house-password", "dracarys");
  assert.equal(withPassword.body.members.length, 5);
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

test("unlocking with the correct password succeeds but isn't shared with other visitors", async () => {
  const res = await request.post("/api/houses/velaryon/unlock").send({ password: "driftmark" });
  assert.equal(res.status, 200);
  assert.equal(res.body.locked, true);
  assert.equal(res.body.members.length, 3);

  // not shared: a plain GET from anyone else is still locked
  const res2 = await request.get("/api/houses/velaryon");
  assert.equal(res2.body.locked, true);
  assert.equal(res2.body.members, undefined);
});

test("writes to a locked house require the password on every request; wrong/missing password is rejected", async () => {
  const noPassword = await request.post("/api/houses/targaryen/members").send({ name: "Should Fail" });
  assert.equal(noPassword.status, 403);

  const wrongPassword = await request
    .post("/api/houses/targaryen/members")
    .set("x-house-password", "nope")
    .send({ name: "Should Also Fail" });
  assert.equal(wrongPassword.status, 403);
});

test("avatar upload requires access, accepts an image, and rejects a disallowed file type", async () => {
  const noAuth = await request
    .post("/api/houses/targaryen/avatar")
    .attach("avatar", Buffer.from("fake-png-bytes"), { filename: "photo.png", contentType: "image/png" });
  assert.equal(noAuth.status, 403);

  const badType = await request
    .post("/api/houses/targaryen/avatar")
    .set("x-house-password", "dracarys")
    .attach("avatar", Buffer.from("just text"), { filename: "notes.txt", contentType: "text/plain" });
  assert.equal(badType.status, 400);

  const ok = await request
    .post("/api/houses/targaryen/avatar")
    .set("x-house-password", "dracarys")
    .attach("avatar", Buffer.from("fake-gif-bytes"), { filename: "photo.gif", contentType: "image/gif" });
  assert.equal(ok.status, 201);
  assert.match(ok.body.url, /^\/api\/uploads\/.+$/);

  // stored in the database, not on disk — survives across deploys
  const fetched = await request.get(ok.body.url);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.headers["content-type"], "image/gif");
  assert.equal(Buffer.from(fetched.body).toString(), "fake-gif-bytes");

  const missing = await request.get("/api/uploads/does-not-exist");
  assert.equal(missing.status, 404);
});

test("a member's parent can belong to a different house, and the API reports who they are", async () => {
  const add = await request
    .post("/api/houses/velaryon/members")
    .set("x-house-password", "driftmark")
    .send({ name: "Jacaerys Velaryon", role: "", parentId: "rhaenyra" });
  assert.equal(add.status, 201);
  assert.equal(add.body.parentId, "rhaenyra");

  const check = await request.get("/api/houses/velaryon").set("x-house-password", "driftmark");
  const child = check.body.members.find((m) => m.name === "Jacaerys Velaryon");
  assert.ok(child);
  assert.deepEqual(child.externalParent, { name: "Rhaenyra", houseSlug: "targaryen", houseName: "Targaryen" });

  // members with a purely local parent don't get an externalParent
  const laenor = check.body.members.find((m) => m.id === "laenor");
  assert.equal(laenor.externalParent, undefined);
});

test("a member can store the Discord account of the real person behind them", async () => {
  const add = await request
    .post("/api/houses/velaryon/members")
    .set("x-house-password", "driftmark")
    .send({ name: "Vaemond", role: "", discordId: "123456789012345678" });
  assert.equal(add.status, 201);
  assert.equal(add.body.discordId, "123456789012345678");

  const edit = await request
    .patch(`/api/houses/velaryon/members/${add.body.id}`)
    .set("x-house-password", "driftmark")
    .send({ name: "Vaemond", role: "", discordId: "987654321098765432" });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.discordId, "987654321098765432");
});

test("adding, editing, and reparent-loop protection on members", async () => {
  const add = await request
    .post("/api/houses/targaryen/members")
    .set("x-house-password", "dracarys")
    .send({ name: "Baela Targaryen", role: "", parentId: "rhaenyra" });
  assert.equal(add.status, 201);
  const newId = add.body.id;
  assert.ok(newId);
  assert.equal(add.body.parentId, "rhaenyra");

  const edit = await request
    .patch(`/api/houses/targaryen/members/${newId}`)
    .set("x-house-password", "dracarys")
    .send({ name: "Baela Targaryen", role: "Rider of Moondancer", parentId: "rhaenyra" });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.role, "Rider of Moondancer");

  // rhaenyra can't become a child of her own new descendant (baela)
  const loop = await request
    .patch("/api/houses/targaryen/members/rhaenyra")
    .set("x-house-password", "dracarys")
    .send({ name: "Rhaenyra", role: "Heir", parentId: newId });
  assert.equal(loop.status, 400);
});

test("deleting a member cascades to descendants and reports the count", async () => {
  // rhaenyra has children jacaerys and (from the previous test) baela
  const del = await request.delete("/api/houses/targaryen/members/rhaenyra").set("x-house-password", "dracarys");
  assert.equal(del.status, 200);
  assert.equal(del.body.removedCount, 3); // rhaenyra + jacaerys + baela

  const check = await request.get("/api/houses/targaryen").set("x-house-password", "dracarys");
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

test("seed-missing adds only houses that don't exist yet, and never touches an existing house's members", async () => {
  const noAuth = await request.post("/api/admin/seed-missing");
  assert.equal(noAuth.status, 401);

  // give hightower some "real" data that must survive
  const added = await request
    .post("/api/houses/hightower/members")
    .set("x-house-password", "oldtown")
    .send({ name: "Lord Ormund Hightower", role: "Lord/Lady Paramount" });
  assert.equal(added.status, 201);

  // simulate a house that hasn't been added to this database yet
  await memPool.query("DELETE FROM houses WHERE slug = $1", ["redwyne"]);
  const missingCheck = await request.get("/api/houses/redwyne");
  assert.equal(missingCheck.status, 404);

  const res = await request.post("/api/admin/seed-missing").set("x-admin-secret", "test-secret");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.added, ["redwyne"]);

  const redwyne = await request.get("/api/houses/redwyne");
  assert.equal(redwyne.status, 200);

  // hightower's real data is untouched
  const hightower = await request.get("/api/houses/hightower").set("x-house-password", "oldtown");
  assert.equal(hightower.body.members.length, 1);
  assert.equal(hightower.body.members[0].name, "Lord Ormund Hightower");

  // running it again with nothing missing adds nothing
  const again = await request.post("/api/admin/seed-missing").set("x-admin-secret", "test-secret");
  assert.deepEqual(again.body.added, []);
});
