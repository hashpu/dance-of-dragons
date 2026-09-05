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
