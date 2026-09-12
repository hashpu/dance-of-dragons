CREATE TABLE IF NOT EXISTS houses (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  faction TEXT NOT NULL,
  color TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT,
  order_index INT NOT NULL DEFAULT 0
);

-- Discord role ID whose holders can manage this house without the password
-- (added after initial launch — IF NOT EXISTS keeps this safe to rerun on every boot)
ALTER TABLE houses ADD COLUMN IF NOT EXISTS lord_role_id TEXT;

-- The specific Roblox account (numeric user ID) that must ALSO be signed in,
-- alongside the Discord role above, for Lord access to be granted. Requiring
-- both stops anyone who merely holds the Discord role from claiming Lord
-- access — they must be the exact person the admin assigned.
ALTER TABLE houses ADD COLUMN IF NOT EXISTS lord_roblox_user_id TEXT;

-- A specific Discord user ID that alone grants Lord access to this house —
-- no Discord bot/guild role lookup and no Roblox account required. Simpler
-- alternative to lord_role_id/lord_roblox_user_id above for admins who
-- haven't set up a bot. Checked first; if unset, falls back to the
-- role+Roblox check.
ALTER TABLE houses ADD COLUMN IF NOT EXISTS lord_discord_user_id TEXT;

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  house_slug TEXT NOT NULL REFERENCES houses(slug) ON DELETE CASCADE,
  parent_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  build_link TEXT NOT NULL DEFAULT '',
  roblox_profile TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS members_house_idx ON members(house_slug);
CREATE INDEX IF NOT EXISTS members_parent_idx ON members(parent_id);

-- The real person's Discord account behind this family-tree character —
-- just a label shown on their card, not tied to any access control (see
-- houses.lord_discord_user_id above for that).
ALTER TABLE members ADD COLUMN IF NOT EXISTS discord_id TEXT NOT NULL DEFAULT '';

-- A spouse is a one-directional pointer, same as parent_id — no house
-- scoping (marrying in from another house's tree is allowed, same as a
-- cross-house parent), and no permission check on the pointed-to member's
-- own house when it's set (see routes/houses.js). A member who married in
-- with no family of their own here (no parent_id) and points to a spouse
-- doesn't get a separate branch in the tree — they're rendered paired
-- inside their spouse's own box instead.
ALTER TABLE members ADD COLUMN IF NOT EXISTS spouse_id TEXT REFERENCES members(id) ON DELETE SET NULL;

-- Uploaded files (member avatars, application images) stored in the
-- database itself rather than on local disk — Render's local filesystem is
-- wiped on every redeploy/restart, but this table lives in the same
-- Postgres database as everything else, so uploads survive updates.
CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per Discord account that has ever signed in on the site (verified
-- via a real Discord API call, see discord.js's recordDiscordUserSeen) —
-- lets the admin dashboard search/assign a Lord by username instead of
-- needing their raw numeric ID, and only from people who've actually signed
-- in here (never pre-populated or guessed).
CREATE TABLE IF NOT EXISTS discord_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per Discord account: which side of the Dance they're backing.
-- Voting again just changes the existing row (see routes/votes.js's
-- upsert) rather than adding a second vote.
CREATE TABLE IF NOT EXISTS votes (
  discord_user_id TEXT PRIMARY KEY,
  choice TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Named staff accounts the owner (whoever knows ADMIN_SECRET) can create,
-- each with its own password, for delegated access to the admin dashboard.
-- Staff can view houses/applications but not the owner-only destructive
-- actions (reset all data, delete a house, manage staff accounts) — see
-- middleware/requireAdmin.js's requireOwner.
CREATE TABLE IF NOT EXISTS staff_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  department TEXT NOT NULL,
  roblox_username TEXT NOT NULL,
  discord_username TEXT NOT NULL,
  availability TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set to 'approved' when an admin approves a ticket in the dashboard — see
-- routes/applications.js's /approve endpoint. There's no applicant login, so
-- this doesn't notify them directly; it just posts to the Discord webhook
-- (same one the original submission used) so the team can follow up.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
