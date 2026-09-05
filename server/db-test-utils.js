const fs = require("fs");
const path = require("path");
const { newDb } = require("pg-mem");

// Monkey-patches the shared db.pool to run against an in-memory Postgres-
// compatible engine, so route/app code (which only ever calls pool.query)
// runs unmodified in tests — no real Postgres needed.
function setupTestDb() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  mem.public.none(schema);
  const { Pool } = mem.adapters.createPg();
  const memPool = new Pool();

  const db = require("./db");
  db.pool.query = memPool.query.bind(memPool);

  return memPool;
}

module.exports = { setupTestDb };
