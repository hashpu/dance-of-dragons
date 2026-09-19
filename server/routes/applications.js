const express = require("express");
const multer = require("multer");
const { pool } = require("../db");
const { findDepartment } = require("../departments");
const { requireAdmin } = require("../middleware/requireAdmin");
const { saveUpload } = require("../uploads");
const { getRequestDiscordUser, getRequestDiscordUserId, sendDiscordDM } = require("../discord");

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

async function postDeclineToDiscord(webhookUrl, dept, app, reason) {
  const embed = {
    title: `❌ ${dept.name} Application Declined`,
    description: `**${app.roblox_username}** (Discord: ${app.discord_username}) was declined for **${dept.name}**.`,
    fields: [{ name: "Reason given", value: truncate(reason) }],
    color: 0xef5b5b,
    timestamp: new Date().toISOString()
  };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  });
  if (!res.ok) throw new Error("Discord webhook responded " + res.status);
}

function applicantDmEmbed({ approved, deptName, reason }) {
  return {
    embeds: [
      approved
        ? {
            title: `✅ You've been accepted!`,
            description: `You accepted the **${deptName}** application. A recruiter will reach out on Discord to get you onboarded.`,
            color: 0x3ecf8e,
            timestamp: new Date().toISOString()
          }
        : {
            title: `${deptName} Application Update`,
            description: `Your **${deptName}** application wasn't accepted this time.`,
            fields: [{ name: "Reason", value: truncate(reason) }],
            color: 0xef5b5b,
            timestamp: new Date().toISOString()
          }
    ]
  };
}

function applicantMessageDmEmbed({ deptName, body }) {
  return {
    embeds: [
      {
        title: `${deptName} Application`,
        description: `You have a new message about your **${deptName}** application.`,
        fields: [{ name: "Message", value: truncate(body) }],
        color: 0xb0b0b5,
        timestamp: new Date().toISOString()
      }
    ]
  };
}

// POST /api/applications — submit an application (multipart if it includes an image).
// Requires being signed in with Discord — the client already gates opening
// the form on this (see apply.js's openApplyModal), but that's only ever a
// courtesy prompt; this is the actual enforcement, so there's no path to a
// submitted application with no verified Discord identity behind it.
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const discordUser = await getRequestDiscordUser(req);
    if (!discordUser) return res.status(401).json({ error: "Sign in with Discord first." });

    const { department, robloxUsername, availability, why } = req.body;
    const dept = findDepartment(department);
    if (!dept) return res.status(400).json({ error: "Unknown department." });

    const { rows: closedRows } = await pool.query("SELECT 1 FROM closed_departments WHERE department = $1", [department]);
    if (closedRows[0]) {
      return res.status(403).json({ error: "This department isn't accepting applications right now." });
    }

    if (!robloxUsername || !why) {
      return res.status(400).json({ error: "Roblox username and 'why' are required." });
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

    // Both the username stored and the ID that lets an approve/decline (or
    // a staff message) notify them later come straight from the verified
    // token above — never a free-typed field the applicant could get wrong
    // or spoof.
    const insertRes = await pool.query(
      `INSERT INTO applications (department, roblox_username, discord_username, availability, why, answers, image_path, discord_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [department, robloxUsername, discordUser.username, availability || "", why, JSON.stringify(answers), imagePath, discordUser.id]
    );

    logApplication(dept, { robloxUsername, discordUsername: discordUser.username, availability, why, answers }, imagePath);

    const webhookUrl = process.env[`WEBHOOK_${department.toUpperCase()}`] || process.env.WEBHOOK_APPLICATIONS;
    if (webhookUrl) {
      try {
        await forwardToDiscord(
          webhookUrl,
          dept,
          { robloxUsername, discordUsername: discordUser.username, availability, why, answers },
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

// GET /api/applications/closed-departments — public, no admin secret: the
// Apply page needs this to show a department as closed to every visitor,
// not just signed-in admins reviewing the dashboard.
router.get("/closed-departments", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT department FROM closed_departments");
    res.json(rows.map((r) => r.department));
  } catch (err) {
    next(err);
  }
});

// GET /api/applications — admin only. Each row also carries its own
// message history (see POST /:id/message), oldest first, so the dashboard
// can show what's already been said before sending another one.
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM applications ORDER BY created_at DESC LIMIT 200");

    const { rows: msgRows } = await pool.query("SELECT * FROM application_messages ORDER BY created_at ASC");
    const messagesByApp = {};
    msgRows.forEach((m) => {
      (messagesByApp[m.application_id] = messagesByApp[m.application_id] || []).push(m);
    });

    res.json(rows.map((r) => ({ ...r, messages: messagesByApp[r.id] || [] })));
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/approve — admin only. Posts to the
// department's Discord webhook so the team can follow up, and — if the
// applicant happened to be signed in with Discord when they applied — DMs
// them directly too. `dmSent` in the response tells the dashboard whether
// that actually went through, since plenty of applicants won't have a
// discord_user_id on file at all.
router.post("/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid application ID." });

    const { rows } = await pool.query(
      "UPDATE applications SET status = 'approved', seen_by_applicant = false WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    const app = rows[0];
    if (!app) return res.status(404).json({ error: "Application not found." });

    const dept = findDepartment(app.department);
    const deptName = dept ? dept.name : app.department;

    const webhookUrl = process.env[`WEBHOOK_${app.department.toUpperCase()}`] || process.env.WEBHOOK_APPLICATIONS;
    if (dept && webhookUrl) {
      try {
        await postApprovalToDiscord(webhookUrl, dept, app);
      } catch (e) {
        console.warn("Discord approval webhook failed:", e.message);
      }
    }

    const dmSent = app.discord_user_id
      ? await sendDiscordDM(app.discord_user_id, applicantDmEmbed({ approved: true, deptName }))
      : false;

    res.json({ ok: true, status: app.status, dmSent });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/decline { reason } — admin only. Same
// notification paths as approve (staff webhook + a DM if we know who they
// are), plus the reason is stored so it shows up in their "my applications"
// panel (GET /mine below) even if the DM never lands.
router.post("/:id/decline", requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid application ID." });
    const reason = (req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "A reason is required." });

    const { rows } = await pool.query(
      "UPDATE applications SET status = 'declined', decline_reason = $2, seen_by_applicant = false WHERE id = $1 RETURNING *",
      [req.params.id, reason]
    );
    const app = rows[0];
    if (!app) return res.status(404).json({ error: "Application not found." });

    const dept = findDepartment(app.department);
    const deptName = dept ? dept.name : app.department;

    const webhookUrl = process.env[`WEBHOOK_${app.department.toUpperCase()}`] || process.env.WEBHOOK_APPLICATIONS;
    if (dept && webhookUrl) {
      try {
        await postDeclineToDiscord(webhookUrl, dept, app, reason);
      } catch (e) {
        console.warn("Discord decline webhook failed:", e.message);
      }
    }

    const dmSent = app.discord_user_id
      ? await sendDiscordDM(app.discord_user_id, applicantDmEmbed({ approved: false, deptName, reason }))
      : false;

    res.json({ ok: true, status: app.status, declineReason: app.decline_reason, dmSent });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/message { message } — admin only. A one-way
// note about the application (a clarifying question, an update) that
// isn't a decision — that stays on /approve and /decline. Same
// notification path as those: a DM if we know who they are, and it's
// stored either way so it still shows up in their "my applications" panel
// (GET /mine) if the DM never lands.
router.post("/:id/message", requireAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid application ID." });
    const body = (req.body.message || "").trim();
    if (!body) return res.status(400).json({ error: "A message is required." });

    const { rows: appRows } = await pool.query("SELECT * FROM applications WHERE id = $1", [req.params.id]);
    const app = appRows[0];
    if (!app) return res.status(404).json({ error: "Application not found." });

    const { rows: msgRows } = await pool.query(
      "INSERT INTO application_messages (application_id, body) VALUES ($1, $2) RETURNING *",
      [app.id, body]
    );

    const dept = findDepartment(app.department);
    const deptName = dept ? dept.name : app.department;

    const dmSent = app.discord_user_id
      ? await sendDiscordDM(app.discord_user_id, applicantMessageDmEmbed({ deptName, body }))
      : false;

    res.status(201).json({ ok: true, message: msgRows[0], dmSent });
  } catch (err) {
    next(err);
  }
});

// GET /api/applications/mine — no admin secret: just whatever the caller's
// own signed-in Discord identity has updates for — decided (not pending)
// applications, same as before, plus any one-way messages an admin sent
// (see POST /:id/message), on ANY application regardless of its status.
// Both come back tagged with `type` so nav.js can render/dismiss them
// differently; the unread-dot filtering itself (apps.filter(a => !a.seen))
// works unchanged on either since both carry a plain `seen` boolean.
router.get("/mine", async (req, res, next) => {
  try {
    const discordUserId = await getRequestDiscordUserId(req);
    if (!discordUserId) return res.json([]);

    const { rows: decisionRows } = await pool.query(
      `SELECT id, department, status, decline_reason, seen_by_applicant, created_at
       FROM applications WHERE discord_user_id = $1 AND status != 'pending'
       ORDER BY created_at DESC LIMIT 50`,
      [discordUserId]
    );
    const { rows: messageRows } = await pool.query(
      `SELECT m.id, m.body, m.seen_by_applicant, m.created_at, a.department
       FROM application_messages m JOIN applications a ON a.id = m.application_id
       WHERE a.discord_user_id = $1
       ORDER BY m.created_at DESC LIMIT 50`,
      [discordUserId]
    );

    const decisions = decisionRows.map((r) => {
      const dept = findDepartment(r.department);
      return {
        type: "decision",
        id: r.id,
        department: r.department,
        departmentName: dept ? dept.name : r.department,
        status: r.status,
        declineReason: r.decline_reason,
        seen: r.seen_by_applicant,
        createdAt: r.created_at
      };
    });
    const messages = messageRows.map((r) => {
      const dept = findDepartment(r.department);
      return {
        type: "message",
        id: r.id,
        department: r.department,
        departmentName: dept ? dept.name : r.department,
        body: r.body,
        seen: r.seen_by_applicant,
        createdAt: r.created_at
      };
    });

    res.json([...decisions, ...messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/seen — no admin secret: the applicant
// dismissing their own notification. Ownership is enforced by matching
// discord_user_id to whoever's actually signed in, not just the ID in the
// URL, so nobody can mark someone else's application as seen.
router.post("/:id/seen", async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid application ID." });
    const discordUserId = await getRequestDiscordUserId(req);
    if (!discordUserId) return res.status(401).json({ error: "Sign in with Discord first." });

    const { rows } = await pool.query(
      "UPDATE applications SET seen_by_applicant = true WHERE id = $1 AND discord_user_id = $2 RETURNING id",
      [req.params.id, discordUserId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Application not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/messages/:messageId/seen — the message-update
// equivalent of /:id/seen above. Ownership is checked through the
// message's own application, not a URL param, so nobody can dismiss a
// message that isn't theirs.
router.post("/messages/:messageId/seen", async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.messageId)) return res.status(400).json({ error: "Invalid message ID." });
    const discordUserId = await getRequestDiscordUserId(req);
    if (!discordUserId) return res.status(401).json({ error: "Sign in with Discord first." });

    const { rows } = await pool.query(
      `UPDATE application_messages SET seen_by_applicant = true
       WHERE id = $1 AND application_id IN (SELECT id FROM applications WHERE discord_user_id = $2)
       RETURNING id`,
      [req.params.messageId, discordUserId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Message not found." });
    res.json({ ok: true });
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
