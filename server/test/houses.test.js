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
  assert.equal(res.body.length, 28);
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
  assert.deepEqual(child.externalParent, { name: "Rhaenyra", houseSlug: "targaryen", houseName: "Targaryen", houseFaction: "ROYAL HOUSE" });

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

test("GET /api/admin/houses gives the admin lock/lord status for every house, but never a password", async () => {
  const noAuth = await request.get("/api/admin/houses");
  assert.equal(noAuth.status, 401);

  const res = await request.get("/api/admin/houses").set("x-admin-secret", "test-secret");
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 28);

  const targaryen = res.body.find((h) => h.slug === "targaryen");
  assert.equal(targaryen.locked, true); // every house starts locked in the default seed
  assert.equal(targaryen.hasPassword, true);
  assert.equal(targaryen.password, undefined); // never exposed, even to the admin — only bcrypt hashes exist
  assert.equal(targaryen.passwordHash, undefined);
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

test("admin can reset a house's password directly, in one step, without knowing the old one", async () => {
  const noAuth = await request.post("/api/admin/houses/arryn/reset-password").send({ password: "newpass" });
  assert.equal(noAuth.status, 401);

  // regular /lock refuses to change an existing password...
  const lockAttempt = await request.post("/api/houses/arryn/lock").send({ password: "ignored" });
  assert.equal(lockAttempt.status, 200);
  const stillOld = await request.post("/api/houses/arryn/unlock").send({ password: "eyrie" });
  assert.equal(stillOld.status, 200);

  const missing = await request.post("/api/admin/houses/does-not-exist/reset-password").set("x-admin-secret", "test-secret").send({ password: "x" });
  assert.equal(missing.status, 404);

  const noPassword = await request.post("/api/admin/houses/arryn/reset-password").set("x-admin-secret", "test-secret").send({});
  assert.equal(noPassword.status, 400);

  // ...but the admin endpoint does, in one step
  const reset = await request
    .post("/api/admin/houses/arryn/reset-password")
    .set("x-admin-secret", "test-secret")
    .send({ password: "newpass" });
  assert.equal(reset.status, 200);

  const oldFails = await request.post("/api/houses/arryn/unlock").send({ password: "eyrie" });
  assert.equal(oldFails.status, 401);

  const newWorks = await request.post("/api/houses/arryn/unlock").send({ password: "newpass" });
  assert.equal(newWorks.status, 200);
});

test("admin can delete a single house, and only that house", async () => {
  const noAuth = await request.delete("/api/admin/houses/redwyne");
  assert.equal(noAuth.status, 401);

  const missing = await request.delete("/api/admin/houses/does-not-exist").set("x-admin-secret", "test-secret");
  assert.equal(missing.status, 404);

  const del = await request.delete("/api/admin/houses/redwyne").set("x-admin-secret", "test-secret");
  assert.equal(del.status, 200);

  const check = await request.get("/api/houses/redwyne");
  assert.equal(check.status, 404);

  // untouched
  const targaryen = await request.get("/api/houses/targaryen");
  assert.equal(targaryen.status, 200);
});

test("GET /api/admin/whoami reports owner vs staff", async () => {
  const owner = await request.get("/api/admin/whoami").set("x-admin-secret", "test-secret");
  assert.equal(owner.status, 200);
  assert.equal(owner.body.role, "owner");
});

test("staff accounts: owner can create/list/delete them, and a staff password grants dashboard access but not owner-only actions", async () => {
  const noAuth = await request.post("/api/admin/staff").send({ name: "Jake", password: "hunter22" });
  assert.equal(noAuth.status, 401);

  const tooShort = await request
    .post("/api/admin/staff")
    .set("x-admin-secret", "test-secret")
    .send({ name: "Jake", password: "abc" });
  assert.equal(tooShort.status, 400);

  const created = await request
    .post("/api/admin/staff")
    .set("x-admin-secret", "test-secret")
    .send({ name: "Jake", password: "hunter22" });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Jake");
  const staffId = created.body.id;

  const list = await request.get("/api/admin/staff").set("x-admin-secret", "test-secret");
  assert.equal(list.status, 200);
  assert.ok(list.body.some((s) => s.id === staffId && s.name === "Jake"));
  assert.equal(list.body[0].password, undefined);
  assert.equal(list.body[0].passwordHash, undefined);

  // the staff password works like an admin secret for read/light actions...
  const asStaff = await request.get("/api/admin/houses").set("x-admin-secret", "hunter22");
  assert.equal(asStaff.status, 200);

  const whoami = await request.get("/api/admin/whoami").set("x-admin-secret", "hunter22");
  assert.equal(whoami.status, 200);
  assert.equal(whoami.body.role, "staff");
  assert.equal(whoami.body.name, "Jake");

  // ...but not for owner-only destructive actions
  const staffReset = await request.post("/api/admin/reset").set("x-admin-secret", "hunter22");
  assert.equal(staffReset.status, 401);

  const staffDeleteHouse = await request.delete("/api/admin/houses/hightower").set("x-admin-secret", "hunter22");
  assert.equal(staffDeleteHouse.status, 401);

  const staffCreatesStaff = await request
    .post("/api/admin/staff")
    .set("x-admin-secret", "hunter22")
    .send({ name: "Nobody", password: "shouldfail" });
  assert.equal(staffCreatesStaff.status, 401);

  // owner revokes the staff account
  const del = await request.delete(`/api/admin/staff/${staffId}`).set("x-admin-secret", "test-secret");
  assert.equal(del.status, 200);

  const afterRevoke = await request.get("/api/admin/houses").set("x-admin-secret", "hunter22");
  assert.equal(afterRevoke.status, 401);
});
