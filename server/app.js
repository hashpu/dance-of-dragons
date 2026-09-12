const express = require("express");
const cors = require("cors");
const path = require("path");

const housesRouter = require("./routes/houses");
const applicationsRouter = require("./routes/applications");
const adminRouter = require("./routes/admin");
const robloxRouter = require("./routes/roblox");
const uploadsRouter = require("./routes/uploads");
const votesRouter = require("./routes/votes");
const discordRouter = require("./routes/discord");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/houses", housesRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/roblox", robloxRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/discord", discordRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Clean URLs: anyone hitting a raw *.html path (an old link, a bookmark, or
// just typing it) gets redirected to the extension-less version, which is
// what every page now links to internally. index.html goes to the bare root.
app.get(/\.html$/, (req, res) => {
  const clean = req.path.replace(/\.html$/, "");
  const target = clean === "/index" ? "/" : clean;
  res.redirect(301, target + req.url.slice(req.path.length));
});

// Serve the static frontend from the project root, one origin for everything.
// extensions:["html"] lets /admin resolve to admin.html on disk.
const ROOT = path.join(__dirname, "..");
app.use(express.static(ROOT, { extensions: ["html"] }));

// Nothing above matched. An unknown API route gets a JSON 404 (so API
// consumers don't have to parse HTML); anything else gets the themed page.
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, "404.html")));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

module.exports = app;
