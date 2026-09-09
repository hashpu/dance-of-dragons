const express = require("express");
const multer = require("multer");
const { pool } = require("../db");
const { findDepartment } = require("../departments");
const { requireAdmin } = require("../middleware/requireAdmin");
const { saveUpload } = require("../uploads");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const router = express.Router();

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

async function postApprovalToDiscord(webhookUrl, dept, app) {
  const embed = {
    title: `✅ ${dept.name} Application Approved`,
    description: `**${app.roblox_username}** (Discord: ${app.discord_username}) was approved for **${dept.name}**. Reach out to them to get them onboarded.`,
    color: parseInt(dept.color.replace("#", ""), 16),
    timestamp: new Date().toISOString()
  };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  });
  if (!res.ok) throw new Error("Discord webhook responded " + res.status);
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
      imageFilename = req.file.originalname || "image.png";
      imagePath = await saveUpload(req.file.buffer, req.file.mimetype);
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

// POST /api/applications/:id/approve — admin only. There's no applicant
// login or verified contact info to notify them directly with, so this just
// marks the ticket approved and posts to the department's Discord webhook
// (same one the original submission used) so the team can follow up.
router.post("/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid application ID." });

    const { rows } = await pool.query("UPDATE applications SET status = 'approved' WHERE id = $1 RETURNING *", [req.params.id]);
    const app = rows[0];
    if (!app) return res.status(404).json({ error: "Application not found." });

    const dept = findDepartment(app.department);
    const webhookUrl = process.env[`WEBHOOK_${app.department.toUpperCase()}`] || process.env.WEBHOOK_APPLICATIONS;
    if (dept && webhookUrl) {
      try {
        await postApprovalToDiscord(webhookUrl, dept, app);
      } catch (e) {
        console.warn("Discord approval webhook failed:", e.message);
      }
    }

    res.json({ ok: true, status: app.status });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/applications/:id — admin only, dismisses one reviewed ticket.
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid application ID." });
    const { rows } = await pool.query("DELETE FROM applications WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Application not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
