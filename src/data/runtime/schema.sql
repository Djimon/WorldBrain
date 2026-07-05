CREATE TABLE IF NOT EXISTS base_entity_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS base_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  properties_json TEXT NOT NULL,
  body_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_entity_overrides (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_notes (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- M10-S03: player identity & per-session membership
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_players (
  session_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  invite_status TEXT NOT NULL DEFAULT 'pending',
  joined_at TEXT,
  PRIMARY KEY (session_id, player_id)
);

-- M10-S04: per-session player groups
CREATE TABLE IF NOT EXISTS player_groups (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_group_members (
  group_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  PRIMARY KEY (group_id, player_id)
);

-- M10-S07: per-player/group visibility overrides
CREATE TABLE IF NOT EXISTS session_visibility_overrides (
  session_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  player_id TEXT,
  group_id TEXT
);
