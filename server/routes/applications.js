const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { pool } = require("../db");
const { findDepartment } = require("../departments");
const { requireAdmin } = require("../middleware/requireAdmin");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

// Discord rejects the entire embed if any field.value exceeds 1024 chars —
// truncate defensively so one long answer can't silently kill the whole post.
function truncate(str, max = 1024) {
  const s = String(str ?? "N/A");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function logApplication(dept, data, imagePath) {
  const lines = [
    `=== New ${dept.name} application ===`,
    `Roblox: ${data.robloxUsername}`,
    `Discord: ${data.discordUsername}`,
    `Availability: ${data.availability || "N/A"}`,
    ...dept.questions.map((q) => `${q.label}: ${data.answers[q.id] || "N/A"}`),
    `Why they want to join: ${data.why}`,
    `Image: ${imagePath || "(none)"}`
  ];
  console.log(lines.join("\n"));
}

async function forwardToDiscord(webhookUrl, dept, data, imageBuffer, imageFilename) {
  const embed = {
    title: `📋 New ${dept.name} Application`,
    description: `A new applicant wants to join **${dept.name}**.`,
    color: parseInt(dept.color.replace("#", ""), 16),
    fields: [
      {
        name: "👤 Applicant",
        value: [
          `**Roblox:** ${truncate(data.robloxUsername, 300)}`,
          `**Discord:** ${truncate(data.discordUsername, 300)}`,
          `**Availability:** ${truncate(data.availability || "N/A", 300)}`
        ].join("\n")
      },
      ...dept.questions.map((q) => ({ name: `📝 ${q.label}`, value: truncate(data.answers[q.id]) })),
      { name: "💬 Why they want to join", value: truncate(data.why) }
    ],
    footer: { text: "Dungeons & Dragons Application System" },
    timestamp: new Date().toISOString()
  };

  if (imageBuffer) {
    embed.image = { url: `attachment://${imageFilename}` };
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ embeds: [embed] }));
    form.append("files[0]", new Blob([imageBuffer]), imageFilename);
    const res = await fetch(webhookUrl, { method: "POST", body: form });
    if (!res.ok) throw new Error("Discord webhook responded " + res.status);
  } else {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
    if (!res.ok) throw new Error("Discord webhook responded " + res.status);
  }
}

// POST /api/applications — submit an application (multipart if it includes an image)
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const { department, robloxUsername, discordUsername, availability, why } = req.body;
    const dept = findDepartment(department);
    if (!dept) return res.status(400).json({ error: "Unknown department." });
    if (!robloxUsername || !discordUsername || !why) {
      return res.status(400).json({ error: "Roblox username, Discord username, and 'why' are required." });
    }

    let answers = {};
    try {
      answers = req.body.answers ? JSON.parse(req.body.answers) : {};
    } catch (e) {
      return res.status(400).json({ error: "Malformed answers payload." });
    }

    const missing = dept.questions.filter((q) => q.required && !answers[q.id]);
    if (missing.length) {
      return res.status(400).json({ error: "Missing required fields: " + missing.map((q) => q.label).join(", ") });
    }

    let imagePath = null;
    let imageFilename = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname) || ".png";
      imageFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, imageFilename), req.file.buffer);
      imagePath = `/uploads/${imageFilename}`;
    }

    const insertRes = await pool.query(
      `INSERT INTO applications (department, roblox_username, discord_username, availability, why, answers, image_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [department, robloxUsername, discordUsername, availability || "", why, JSON.stringify(answers), imagePath]
    );

    logApplication(dept, { robloxUsername, discordUsername, availability, why, answers }, imagePath);

    const webhookUrl = process.env[`WEBHOOK_${department.toUpperCase()}`] || process.env.WEBHOOK_APPLICATIONS;
    if (webhookUrl) {
      try {
        await forwardToDiscord(
          webhookUrl,
          dept,
          { robloxUsername, discordUsername, availability, why, answers },
          req.file ? req.file.buffer : null,
          imageFilename
        );
      } catch (e) {
        console.warn("Discord webhook forward failed:", e.message);
      }
    }

    res.status(201).json({ ok: true, id: insertRes.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// GET /api/applications — admin only
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM applications ORDER BY created_at DESC LIMIT 200");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
