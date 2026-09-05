/* Demo/verification entry point ONLY — runs the real server against an
   in-memory Postgres-compatible engine so it can be exercised without a
   real database installed. Production use is `npm start` with a real
   DATABASE_URL; this file is not part of that path. */
require("dotenv").config();
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "test-secret";

const { setupTestDb } = require("./db-test-utils");
const memPool = setupTestDb();
const { seed } = require("./seed");
const app = require("./app");

seed(memPool).then(() => {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Demo server (in-memory DB) on http://localhost:${PORT}`));
});
