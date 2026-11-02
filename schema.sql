-- dave-fit / D1 schema.  Apply with:
--   npm run db:local     (wrangler --local)
--   npm run db:remote    (production)
-- Safe to re-run.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  handle        TEXT NOT NULL,            -- stage name as typed
  handle_lower  TEXT NOT NULL UNIQUE,     -- uniqueness is case-insensitive
  password_hash TEXT NOT NULL,            -- PBKDF2-SHA256, base64
  salt          TEXT NOT NULL,            -- base64
  created_at    TEXT NOT NULL
);

-- Denormalised on purpose: streaks are miserable to compute in SQL on every
-- leaderboard read, and this keeps the board a single indexed query.
CREATE TABLE IF NOT EXISTS user_stats (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lifetime_points   INTEGER NOT NULL DEFAULT 0,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_workout_date TEXT,                 -- YYYY-MM-DD in the leaderboard zone
  workout_count     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS invite_codes (
  code     TEXT PRIMARY KEY,
  label    TEXT,
  uses     INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,                        -- NULL = unlimited
  active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workouts (
  id           TEXT PRIMARY KEY,           -- client-generated UUID, so a replayed
                                           -- offline submission is a no-op
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL,
  local_date   TEXT NOT NULL,              -- YYYY-MM-DD, leaderboard zone
  week_key     TEXT NOT NULL,              -- e.g. 2026-W44
  intensity    TEXT NOT NULL,
  points       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workouts_week ON workouts(week_key, user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS workout_items (
  id          TEXT PRIMARY KEY,
  workout_id  TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  mode        TEXT NOT NULL,               -- 'reps' | 'hold'
  target      INTEGER NOT NULL,            -- per-set prescription
  actual      INTEGER NOT NULL,            -- total reps, or total seconds held
  sets_done   INTEGER NOT NULL,
  points      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_workout ON workout_items(workout_id);
CREATE INDEX IF NOT EXISTS idx_items_slug ON workout_items(slug);

-- The shared invite code. Change it here, or with:
--   wrangler d1 execute dave-fit --remote \
--     --command "UPDATE invite_codes SET active=0 WHERE code='SHRED1989'"
INSERT OR IGNORE INTO invite_codes (code, label, max_uses)
VALUES ('SHRED1989', 'shared signup code', NULL);
