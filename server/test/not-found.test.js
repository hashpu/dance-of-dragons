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

test("a raw *.html path redirects to its extension-less clean URL, and the clean URL serves the page", async () => {
  const admin = await request.get("/admin.html");
  assert.equal(admin.status, 301);
  assert.equal(admin.headers.location, "/admin");

  const index = await request.get("/index.html");
  assert.equal(index.status, 301);
  assert.equal(index.headers.location, "/");

  const withQuery = await request.get("/house.html?h=stark");
  assert.equal(withQuery.status, 301);
  assert.equal(withQuery.headers.location, "/house?h=stark");

  const cleanAdmin = await request.get("/admin");
  assert.equal(cleanAdmin.status, 200);
  assert.match(cleanAdmin.headers["content-type"], /html/);
});
