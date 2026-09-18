const test = require("node:test");
const assert = require("node:assert");
process.env.ADMIN_SECRET = "test-secret";

const { setupTestDb } = require("../db-test-utils");
setupTestDb();
const app = require("../app");
const request = require("supertest")(app);

test("POST /api/admin/staff requires the owner", async () => {
  const res = await request.post("/api/admin/staff").send({ name: "Jon", password: "hunter2" });
  assert.equal(res.status, 401);
});

test("POST /api/admin/staff rejects a payload missing both a Discord account and a name/password", async () => {
  const res = await request.post("/api/admin/staff").set("x-admin-secret", "test-secret").send({});
  assert.equal(res.status, 400);
});

test("adding staff with a name and password lets them log in with that password afterward", async () => {
  const created = await request
    .post("/api/admin/staff")
    .set("x-admin-secret", "test-secret")
    .send({ name: "Jon", password: "hunter2" });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Jon");
  assert.ok(created.body.id);

  const whoami = await request.get("/api/admin/whoami").set("x-admin-secret", "hunter2");
  assert.equal(whoami.status, 200);
  assert.equal(whoami.body.role, "staff");
  assert.equal(whoami.body.name, "Jon");
});

test("a wrong password for a password-based staff account is rejected", async () => {
  const res = await request.get("/api/admin/whoami").set("x-admin-secret", "not-the-password");
  assert.equal(res.status, 401);
});

test("the new staff account shows up in the staff list and can be revoked", async () => {
  const created = await request
    .post("/api/admin/staff")
    .set("x-admin-secret", "test-secret")
    .send({ name: "Arya", password: "needleneedle" });
  assert.equal(created.status, 201);

  const list = await request.get("/api/admin/staff").set("x-admin-secret", "test-secret");
  assert.equal(list.status, 200);
  assert.ok(list.body.some((s) => s.id === created.body.id && s.name === "Arya"));

  const revoke = await request.delete(`/api/admin/staff/${created.body.id}`).set("x-admin-secret", "test-secret");
  assert.equal(revoke.status, 200);

  const whoamiAfterRevoke = await request.get("/api/admin/whoami").set("x-admin-secret", "needleneedle");
  assert.equal(whoamiAfterRevoke.status, 401);
});
