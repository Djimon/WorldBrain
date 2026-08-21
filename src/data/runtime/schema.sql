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

-- M10-S20 (#349): Campaign-Klammer (D23). Eine Welt → mehrere Campaigns.
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  world_time_start TEXT,
  created_at TEXT NOT NULL
);

-- Overrides sind campaign-scoped (D23 — nicht mehr welt-global).
CREATE TABLE IF NOT EXISTS campaign_entity_overrides (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_notes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_players (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  token_hash TEXT,
  status TEXT NOT NULL,
  joined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_groups (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  PRIMARY KEY (group_id, player_id)
);

-- M10-S07 (#356): Per-Spieler/Gruppen-Visibility (Decisions 5–7).
-- scope='player' → player_id gesetzt; scope='group' → group_id gesetzt.
CREATE TABLE IF NOT EXISTS session_visibility_overrides (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  player_id TEXT,
  group_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
