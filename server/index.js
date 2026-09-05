require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");
const { seed } = require("./seed");
const app = require("./app");

async function bootstrap() {
  // Idempotent: safe to run on every boot/redeploy (CREATE TABLE IF NOT EXISTS).
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);

  // Only seed default lore the very first time — never overwrites a live site's data.
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM houses");
  if (rows[0].count === 0) {
    console.log("No houses found — seeding default lore...");
    await seed(pool);
  }

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Dance of Dragons server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
