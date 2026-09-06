const test = require("node:test");
const assert = require("node:assert");

const { setupTestDb } = require("../db-test-utils");
setupTestDb();
const app = require("../app");
const request = require("supertest")(app);

test("an unknown API route gets a JSON 404", async () => {
  const res = await request.get("/api/this-does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "Not found.");
});

test("an unknown page route gets the themed 404 page", async () => {
  const res = await request.get("/this-page-does-not-exist");
  assert.equal(res.status, 404);
  assert.match(res.headers["content-type"], /html/);
  assert.match(res.text, /404/);
});
