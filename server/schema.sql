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

-- Named staff accounts the owner grants delegated access to the admin
-- dashboard. Staff can view houses/applications but not the owner-only
-- destructive actions (reset all data, delete a house, manage staff
-- accounts) — see middleware/requireAdmin.js's requireOwner.
CREATE TABLE IF NOT EXISTS staff_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The normal path now: the owner picks a Discord account that has already
-- signed in on the site (see discord_users above) and that account alone
-- gets in, no password involved. password_hash above is kept only for
-- accounts created before this existed; IF NOT EXISTS/DROP NOT NULL keep
-- this safe to rerun on every boot.
ALTER TABLE staff_accounts ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE staff_accounts ADD COLUMN IF NOT EXISTS discord_user_id TEXT REFERENCES discord_users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_discord_user_id_key ON staff_accounts (discord_user_id) WHERE discord_user_id IS NOT NULL;

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

-- 'pending' | 'approved' | 'declined' — set by the /approve and /decline
-- endpoints in routes/applications.js.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Which Discord account submitted this, IF they happened to be signed in
-- with Discord on the site at the moment they applied (captured server-side
-- from their own auth token — never from the free-typed discord_username
-- field above, which can't be trusted to name a real account). There's
-- still no applicant login, so this is the only reliable way to notify an
-- applicant of a decision: a DM (see discord.js's sendDiscordDM) and the
-- "my applications" panel in nav.js both key off this, and both simply have
-- nothing to show someone who wasn't signed in when they applied.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS discord_user_id TEXT;
CREATE INDEX IF NOT EXISTS applications_discord_user_idx ON applications(discord_user_id);

-- Set together with status = 'declined' by the /decline endpoint.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decline_reason TEXT NOT NULL DEFAULT '';

-- Flips to true once the applicant has dismissed the decision in their "my
-- applications" panel (see POST /:id/seen) — drives the unread dot on their
-- profile menu. Reset to false whenever a new decision is made.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS seen_by_applicant BOOLEAN NOT NULL DEFAULT false;
