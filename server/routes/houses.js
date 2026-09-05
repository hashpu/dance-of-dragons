const express = require("express");
const bcrypt = require("bcrypt");
const { pool } = require("../db");
const { isLordOfHouse, isAdminRequest } = require("../discord");

const router = express.Router();

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

// GET /api/houses/:slug — full detail; members omitted while locked, unless the
// caller is signed in as this house's Discord "Lord"
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
      if (!lordAccess) return res.json(base);
      const membersRes = await pool.query("SELECT * FROM members WHERE house_slug = $1", [house.slug]);
      return res.json({ ...base, lordAccess: true, members: membersRes.rows.map(toMemberJson) });
    }

    const membersRes = await pool.query("SELECT * FROM members WHERE house_slug = $1", [house.slug]);
    res.json({ ...base, members: membersRes.rows.map(toMemberJson) });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/unlock { password }
router.post("/:slug/unlock", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [req.params.slug]);
    const house = rows[0];
    if (!house) return res.status(404).json({ error: "House not found." });
    if (!house.locked) return res.status(400).json({ error: "This house isn't locked." });

    const { password } = req.body;
    const matches = house.password_hash && (await bcrypt.compare(password || "", house.password_hash));
    if (!matches) return res.status(401).json({ error: "Wrong password." });

    await pool.query("UPDATE houses SET locked = false WHERE slug = $1", [house.slug]);
    const membersRes = await pool.query("SELECT * FROM members WHERE house_slug = $1", [house.slug]);
    res.json({
      slug: house.slug,
      name: house.name,
      faction: house.faction,
      color: house.color,
      tagline: house.tagline,
      description: house.description,
      locked: false,
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
// Allowed for the site admin, or for this house's own Discord Lord.
router.post("/:slug/forgot-password", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [req.params.slug]);
    const house = rows[0];
    if (!house) return res.status(404).json({ error: "House not found." });

    if (!isAdminRequest(req) && !(await isLordOfHouse(req, house))) {
      return res.status(401).json({ error: "Not authorized to reset this house's lock." });
    }

    await pool.query("UPDATE houses SET locked = false, password_hash = NULL WHERE slug = $1", [house.slug]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/houses/:slug/lord-role { roleId } — admin-only: assigns which Discord
// role can manage this house without its password
router.post("/:slug/lord-role", async (req, res, next) => {
  try {
    if (!isAdminRequest(req)) return res.status(401).json({ error: "Admin secret required." });
    const { roleId } = req.body;
    const { rowCount } = await pool.query("UPDATE houses SET lord_role_id = $2 WHERE slug = $1", [
      req.params.slug,
      roleId || null
    ]);
    if (!rowCount) return res.status(404).json({ error: "House not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Unlocked, or the caller is signed in as this house's Discord Lord.
async function authorizeEdit(req, res, slug) {
  const { rows } = await pool.query("SELECT * FROM houses WHERE slug = $1", [slug]);
  const house = rows[0];
  if (!house) {
    res.status(404).json({ error: "House not found." });
    return null;
  }
  if (house.locked && !(await isLordOfHouse(req, house))) {
    res.status(403).json({ error: "This house is locked." });
    return null;
  }
  return house;
}

// POST /api/houses/:slug/members — add a member
router.post("/:slug/members", async (req, res, next) => {
  try {
    if (!(await authorizeEdit(req, res, req.params.slug))) return;

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
    res.status(201).json(toMemberJson(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/houses/:slug/members/:id — edit a member (including reparenting)
router.patch("/:slug/members/:id", async (req, res, next) => {
  try {
    if (!(await authorizeEdit(req, res, req.params.slug))) return;

    const { id } = req.params;
    const existing = await pool.query("SELECT id FROM members WHERE id = $1 AND house_slug = $2", [id, req.params.slug]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Member not found." });

    const { name, role, parentId, avatarUrl, buildLink, robloxProfile, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });

    if (parentId) {
      if (parentId === id) return res.status(400).json({ error: "A member can't be their own parent." });
      const descendantIds = await getDescendantIds(req.params.slug, id);
      if (descendantIds.includes(parentId)) {
        return res.status(400).json({ error: "Can't set a descendant as the parent — that would create a loop." });
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
    if (!(await authorizeEdit(req, res, req.params.slug))) return;

    const { id } = req.params;
    const existing = await pool.query("SELECT id FROM members WHERE id = $1 AND house_slug = $2", [id, req.params.slug]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Member not found." });

    const descendantIds = await getDescendantIds(req.params.slug, id);
    await pool.query("DELETE FROM members WHERE id = $1 AND house_slug = $2", [id, req.params.slug]);
    res.json({ ok: true, removedCount: descendantIds.length + 1 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
