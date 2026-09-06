const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { pool } = require("../db");
const { isLordOfHouse, isAdminRequest, getRequestDiscordUserId } = require("../discord");
const { resolveRobloxUsername } = require("../roblox");
const { postLog } = require("../logs");

const router = express.Router();

const AVATAR_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "avatars");
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, ALLOWED_AVATAR_TYPES.has(file.mimetype));
  }
});

function toMemberJson(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    role: row.role,
    avatarUrl: row.avatar_url,
    buildLink: row.build_link,
    robloxProfile: row.roblox_profile,
    note: row.note
  };
}

function toHouseSummaryJson(row) {
  return {
    slug: row.slug,
    name: row.name,
    faction: row.faction,
    color: row.color,
    tagline: row.tagline,
    description: row.description,
    locked: row.locked,
    memberCount: Number(row.member_count)
  };
}

// Proves the caller knows this house's password for THIS request only — the
// client only ever holds the password in page memory (see tree.js), never
// persists it, and never sends it to unrelated houses. Used as an
// alternative to Lord access so a correct password grants read/write access
// without ever flipping the house's `locked` column — every fresh page
// visit has to re-enter it.
async function hasHousePassword(req, house) {
  const password = req.get("x-house-password");
  if (!password || !house.password_hash) return false;
  return bcrypt.compare(password, house.password_hash);
}

function makeMemberId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${slug || "member"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Computed in JS rather than a recursive CTE — trees here are small, and this
// keeps the query portable across databases (recursive CTEs aren't universally
// supported, e.g. by the in-memory Postgres used in this project's tests).
async function getDescendantIds(houseSlug, memberId) {
  const { rows } = await pool.query("SELECT id, parent_id FROM members WHERE house_slug = $1", [houseSlug]);
  const ids = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (row.parent_id && (row.parent_id === memberId || ids.has(row.parent_id)) && !ids.has(row.id)) {
        ids.add(row.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

// GET /api/houses — list all houses with member counts (always visible, even if locked)
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.slug, h.name, h.faction, h.color, h.tagline, h.description, h.locked, h.order_index,
              COUNT(m.id) AS member_count
       FROM houses h
       LEFT JOIN members m ON m.house_slug = h.slug
       GROUP BY h.slug, h.name, h.faction, h.color, h.tagline, h.description, h.locked, h.order_index
       ORDER BY h.order_index`
    );
    res.json(rows.map(toHouseSummaryJson));
  } catch (err) {
    next(err);
  }
});

// GET /api/houses/:slug — full detail; members omitted while locked, unless
// the caller is signed in as this house's Discord "Lord" or sends the
// correct x-house-password header for this one request.
router.get("/:slug", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [req.params.slug]);
    const house = rows[0];
    if (!house) return res.status(404).json({ error: "House not found." });

    const base = {
      slug: house.slug,
      name: house.name,
      faction: house.faction,
      color: house.color,
      tagline: house.tagline,
      description: house.description,
      locked: house.locked
    };

    if (house.locked) {
      const lordAccess = await isLordOfHouse(req, house);
      if (!lordAccess && !(await hasHousePassword(req, house))) return res.json(base);
      const membersRes = await pool.query("SELECT * FROM members WHERE house_slug = $1", [house.slug]);
      return res.json({ ...base, ...(lordAccess ? { lordAccess: true } : {}), members: membersRes.rows.map(toMemberJson) });
    }

    const membersRes = await pool.query("SELECT * FROM members WHERE house_slug = $1", [house.slug]);
    res.json({ ...base, members: membersRes.rows.map(toMemberJson) });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/unlock { password } — verifies the password and
// hands back the members for this one response. Deliberately doesn't touch
// the `locked` column: unlocking only lasts for the current page visit (the
// browser keeps the password in memory, see tree.js, and resends it on
// later requests as x-house-password). Every fresh visit — for this visitor
// or anyone else — is locked again and has to re-enter it.
router.post("/:slug/unlock", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [req.params.slug]);
    const house = rows[0];
    if (!house) return res.status(404).json({ error: "House not found." });
    if (!house.locked) return res.status(400).json({ error: "This house isn't locked." });

    const { password } = req.body;
    const matches = house.password_hash && (await bcrypt.compare(password || "", house.password_hash));
    if (!matches) return res.status(401).json({ error: "Wrong password." });

    const membersRes = await pool.query("SELECT * FROM members WHERE house_slug = $1", [house.slug]);
    res.json({
      slug: house.slug,
      name: house.name,
      faction: house.faction,
      color: house.color,
      tagline: house.tagline,
      description: house.description,
      locked: true,
      members: membersRes.rows.map(toMemberJson)
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/lock { password? } — password only required the first time
router.post("/:slug/lock", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [req.params.slug]);
    const house = rows[0];
    if (!house) return res.status(404).json({ error: "House not found." });

    if (house.password_hash) {
      await pool.query("UPDATE houses SET locked = true WHERE slug = $1", [house.slug]);
      return res.json({ ok: true });
    }

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "A password is required to lock this house for the first time." });
    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE houses SET locked = true, password_hash = $2 WHERE slug = $1", [house.slug, hash]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/forgot-password — clears the lock without the password.
// Admin-only: a house's Lord can view/edit while it's locked (see isLordOfHouse
// below), but can't fully unlock it — only the site admin can do that.
router.post("/:slug/forgot-password", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [req.params.slug]);
    const house = rows[0];
    if (!house) return res.status(404).json({ error: "House not found." });

    if (!isAdminRequest(req)) {
      return res.status(401).json({ error: "Only the site admin can reset a house's lock." });
    }

    await pool.query("UPDATE houses SET locked = false, password_hash = NULL WHERE slug = $1", [house.slug]);
    await postLog("🔓 House lock reset", `**${house.name}**'s lock was reset by the site admin.`, 0xd4af37);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/lord-role { roleId, robloxUsername } — admin-only: assigns
// which Discord role AND which specific Roblox account together can manage this
// house without its password. Both must match the same visitor — holding the
// Discord role alone isn't enough.
router.post("/:slug/lord-role", async (req, res, next) => {
  try {
    if (!isAdminRequest(req)) return res.status(401).json({ error: "Admin secret required." });
    const { rows } = await pool.query("SELECT name FROM houses WHERE slug = $1", [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: "House not found." });

    const { roleId, robloxUsername } = req.body;

    let robloxUserId = null;
    let robloxDisplayName = null;
    if (robloxUsername && robloxUsername.trim()) {
      const match = await resolveRobloxUsername(robloxUsername.trim());
      if (!match) return res.status(400).json({ error: `Could not find a Roblox account named "${robloxUsername}".` });
      robloxUserId = match.id;
      robloxDisplayName = match.username;
    }

    await pool.query("UPDATE houses SET lord_role_id = $2, lord_roblox_user_id = $3 WHERE slug = $1", [
      req.params.slug,
      roleId || null,
      robloxUserId
    ]);

    await postLog(
      "🛡️ Lord updated",
      roleId
        ? `**${rows[0].name}**'s Lord was set to Discord role \`${roleId}\`${robloxDisplayName ? ` + Roblox account **${robloxDisplayName}**` : " (no Roblox account required)"} by an admin.`
        : `**${rows[0].name}**'s Lord was cleared by an admin.`,
      0xd4af37
    );

    res.json({ ok: true, robloxUserId, robloxUsername: robloxDisplayName });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/lord-discord { discordUserId } — admin-only: assigns
// one exact Discord user ID that alone grants Lord access to this house, no
// bot/guild role or Roblox account required. Leave discordUserId blank to
// remove it.
router.post("/:slug/lord-discord", async (req, res, next) => {
  try {
    if (!isAdminRequest(req)) return res.status(401).json({ error: "Admin secret required." });
    const { rows } = await pool.query("SELECT name FROM houses WHERE slug = $1", [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: "House not found." });

    const { discordUserId } = req.body;
    const id = discordUserId && discordUserId.trim() ? discordUserId.trim() : null;

    await pool.query("UPDATE houses SET lord_discord_user_id = $2 WHERE slug = $1", [req.params.slug, id]);

    await postLog(
      "🛡️ Lord updated",
      id
        ? `**${rows[0].name}**'s Lord was set to Discord ID \`${id}\` by an admin.`
        : `**${rows[0].name}**'s Discord-ID Lord was cleared by an admin.`,
      0xd4af37
    );

    res.json({ ok: true, discordUserId: id });
  } catch (err) {
    next(err);
  }
});

// Unlocked, or the caller is signed in as this house's Discord Lord, or sent
// the correct x-house-password for this one request. Only the Lord case is
// logged by the caller as a privileged edit (the house is otherwise locked
// to everyone else).
//
// A Lord's bypass only ever covers adding new members (pass
// allowLordBypass: false from the edit/remove routes) — they don't get to
// change or delete people already in the tree without the house password,
// same as anyone else.
async function authorizeEdit(req, res, slug, { allowLordBypass = true } = {}) {
  const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [slug]);
  const house = rows[0];
  if (!house) {
    res.status(404).json({ error: "House not found." });
    return null;
  }
  if (!house.locked) return { house, viaLordBypass: false };

  const isLord = await isLordOfHouse(req, house);
  if (isLord && allowLordBypass) return { house, viaLordBypass: true };
  if (await hasHousePassword(req, house)) return { house, viaLordBypass: false };

  if (isLord) {
    res.status(403).json({ error: "As this house's Lord you can add new members, but editing or removing existing ones needs the house password." });
    return null;
  }

  res.status(403).json({ error: "This house is locked." });
  return null;
}

async function logLordEdit(req, house, action) {
  const userId = await getRequestDiscordUserId(req);
  await postLog("✍️ Lord edited a locked house", `**${house.name}**: ${action} by Discord ID \`${userId}\`.`, 0xd4af37);
}

// POST /api/houses/:slug/avatar { avatar: <file> } — uploads a member photo/GIF
// and returns its URL, for use as a member's avatarUrl. Same access rules as
// adding a member (unlocked, Lord, or house password).
router.post("/:slug/avatar", (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Image is too large (5MB max)." });
    }
    next(err);
  });
}, async (req, res, next) => {
  try {
    const access = await authorizeEdit(req, res, req.params.slug);
    if (!access) return;

    if (!req.file) return res.status(400).json({ error: "Attach a PNG, JPEG, GIF, or WEBP image." });

    const ext = { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp" }[req.file.mimetype];
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(AVATAR_UPLOAD_DIR, filename), req.file.buffer);

    res.status(201).json({ url: `/uploads/avatars/${filename}` });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/members — add a member
router.post("/:slug/members", async (req, res, next) => {
  try {
    const access = await authorizeEdit(req, res, req.params.slug);
    if (!access) return;

    const { name, role, parentId, avatarUrl, buildLink, robloxProfile, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });

    if (parentId) {
      const parent = await pool.query("SELECT id FROM members WHERE id = $1 AND house_slug = $2", [parentId, req.params.slug]);
      if (!parent.rows[0]) return res.status(400).json({ error: "Parent not found in this house." });
    }

    const id = makeMemberId(name.trim());
    const { rows } = await pool.query(
      `INSERT INTO members (id, house_slug, parent_id, name, role, avatar_url, build_link, roblox_profile, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.params.slug, parentId || null, name.trim(), role || "", avatarUrl || "", buildLink || "", robloxProfile || "", note || ""]
    );
    if (access.viaLordBypass) await logLordEdit(req, access.house, `added member "${name.trim()}"`);
    res.status(201).json(toMemberJson(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/houses/:slug/members/:id — edit a member (including reparenting)
router.patch("/:slug/members/:id", async (req, res, next) => {
  try {
    const access = await authorizeEdit(req, res, req.params.slug, { allowLordBypass: false });
    if (!access) return;

    const { id } = req.params;
    const existing = await pool.query("SELECT id FROM members WHERE id = $1 AND house_slug = $2", [id, req.params.slug]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Member not found." });

    const { name, role, parentId, avatarUrl, buildLink, robloxProfile, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });

    if (parentId) {
      if (parentId === id) return res.status(400).json({ error: "A member can't be their own parent." });
      const descendantIds = await getDescendantIds(req.params.slug, id);
      if (descendantIds.includes(parentId)) {
        return res.status(400).json({ error: "Can't set a descendant as the parent. That would create a loop." });
      }
      const parent = await pool.query("SELECT id FROM members WHERE id = $1 AND house_slug = $2", [parentId, req.params.slug]);
      if (!parent.rows[0]) return res.status(400).json({ error: "Parent not found in this house." });
    }

    const { rows } = await pool.query(
      `UPDATE members SET name=$1, role=$2, parent_id=$3, avatar_url=$4, build_link=$5, roblox_profile=$6, note=$7
       WHERE id=$8 AND house_slug=$9 RETURNING *`,
      [name.trim(), role || "", parentId || null, avatarUrl || "", buildLink || "", robloxProfile || "", note || "", id, req.params.slug]
    );
    res.json(toMemberJson(rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/houses/:slug/members/:id — cascades to descendants
router.delete("/:slug/members/:id", async (req, res, next) => {
  try {
    const access = await authorizeEdit(req, res, req.params.slug, { allowLordBypass: false });
    if (!access) return;

    const { id } = req.params;
    const existing = await pool.query("SELECT id, name FROM members WHERE id = $1 AND house_slug = $2", [id, req.params.slug]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Member not found." });

    const descendantIds = await getDescendantIds(req.params.slug, id);
    await pool.query("DELETE FROM members WHERE id = $1 AND house_slug = $2", [id, req.params.slug]);
    res.json({ ok: true, removedCount: descendantIds.length + 1 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
