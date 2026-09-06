const express = require("express");
const cors = require("cors");
const path = require("path");

const housesRouter = require("./routes/houses");
const applicationsRouter = require("./routes/applications");
const adminRouter = require("./routes/admin");
const robloxRouter = require("./routes/roblox");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/houses", housesRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/roblox", robloxRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Serve the static frontend from the project root, one origin for everything.
const ROOT = path.join(__dirname, "..");
app.use(express.static(ROOT));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

module.exports = app;
