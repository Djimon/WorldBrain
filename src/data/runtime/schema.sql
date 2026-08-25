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

-- M10-S16 (#362): Kampflog (D17). Sichtbarkeit routing-relevant: 'private'
-- (nur Werfer), 'dm_only' (Werfer + DM), 'all' (alle Mitglieder).
CREATE TABLE IF NOT EXISTS combat_log (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  actor_display TEXT NOT NULL,
  actor_player_id TEXT,
  text TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M10-S15 (#361): Spotlight/Whiteboard (D19). type='shared' → gemeinsam
-- (target_player_id NULL), type='private' → nur für target_player_id sichtbar.
CREATE TABLE IF NOT EXISTS whiteboards (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  type TEXT NOT NULL,
  target_player_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whiteboard_elements (
  id TEXT PRIMARY KEY,
  whiteboard_id TEXT NOT NULL,
  element_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

-- M13-S04 (#239): pro Session aktivierte House-Rule-Overlay-Module.
CREATE TABLE IF NOT EXISTS session_active_overlays (
  session_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, module_id)
);

-- M13-S01 (rule_modules): benannte, teilbare House-Rule-Overlays.
CREATE TABLE IF NOT EXISTS rule_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_system_id TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M13-S01 (rule_module_entries): einzelne Regel-Patches eines Moduls.
CREATE TABLE IF NOT EXISTS rule_module_entries (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  target TEXT NOT NULL,
  op TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT 'null'
);

-- M13-S05 (#240): session-lokale Ad-hoc-Overrides (implizites Session-Modul).
CREATE TABLE IF NOT EXISTS session_ad_hoc_overrides (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  target TEXT NOT NULL,
  op TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT 'null',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M16-S10 (#327): projekt-lokaler Cache für vorberechnete Graph-Layout-
-- Positionen. Schlüssel = structureHash(model). Bei Cache-Hit lädt der
-- Consumer die Positionen direkt (kein Cold-Settle).
CREATE TABLE IF NOT EXISTS graph_layout_cache (
  structure_hash TEXT PRIMARY KEY,
  positions_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
