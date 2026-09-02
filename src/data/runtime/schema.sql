CREATE TABLE IF NOT EXISTS base_entity_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Column defaults mirror db-init.ts (the runtime's own CREATE) so that partial INSERTs
-- (e.g. the legacy createEntity, which omits aliases_json/body_json/visibility) succeed
-- against this schema too — the two must not drift.
CREATE TABLE IF NOT EXISTS base_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  properties_json TEXT NOT NULL DEFAULT '{}',
  body_json TEXT NOT NULL DEFAULT '{"format":"portable_blocks_v1","blocks":[]}',
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M10-S20 (#349): campaign bracket (D23). One world → multiple campaigns.
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  world_time_start TEXT,
  active_map_id TEXT,
  created_at TEXT NOT NULL
);

-- Overrides are campaign-scoped (D23 — no longer world-global).
-- M10-S21 (#365): promoted_at + pre_promote_json make promote REVERSIBLE —
-- the override is retained after the promote (traceable), and the
-- previous world state is snapshotted so that unpromote restores it.
CREATE TABLE IF NOT EXISTS campaign_entity_overrides (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  promoted_at TEXT,
  pre_promote_json TEXT,
  -- #415: 1 = this override IS a campaign-created entity (no base_entities row);
  -- patch_json then holds the FULL entity. 0 = normal patch on an existing base entity.
  campaign_created INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_entity_overrides_key
  ON campaign_entity_overrides (campaign_id, entity_id);

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

-- M10-S16 (#362): combat log (D17). Visibility is routing-relevant: 'private'
-- (roller only), 'dm_only' (roller + DM), 'all' (all members).
CREATE TABLE IF NOT EXISTS combat_log (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  actor_display TEXT NOT NULL,
  actor_player_id TEXT,
  text TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M10-S15 (#361): spotlight/whiteboard (D19). type='shared' → shared
-- (target_player_id NULL), type='private' → visible only to target_player_id.
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

-- M10-S07 (#356): per-player/group visibility (Decisions 5–7).
-- scope='player' → player_id set; scope='group' → group_id set.
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

-- M13-S04 (#239): house-rule overlay modules activated per session.
CREATE TABLE IF NOT EXISTS session_active_overlays (
  session_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, module_id)
);

-- M13-S01 (rule_modules): named, shareable house-rule overlays.
CREATE TABLE IF NOT EXISTS rule_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_system_id TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M13-S01 (rule_module_entries): individual rule patches of a module.
CREATE TABLE IF NOT EXISTS rule_module_entries (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  target TEXT NOT NULL,
  op TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT 'null'
);

-- M13-S05 (#240): session-local ad-hoc overrides (implicit session module).
CREATE TABLE IF NOT EXISTS session_ad_hoc_overrides (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  target TEXT NOT NULL,
  op TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT 'null',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M16-S10 (#327): project-local cache for precomputed graph-layout
-- positions. Key = structureHash(model). On a cache hit the
-- consumer loads the positions directly (no cold settle).
CREATE TABLE IF NOT EXISTS graph_layout_cache (
  structure_hash TEXT PRIMARY KEY,
  positions_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M10-D30 (#376): player characters moved out of base_entities → their own
-- campaign-scoped table. The sheet lives in sheet_json (freely structured).
CREATE TABLE IF NOT EXISTS player_characters (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  sheet_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M10-S17 (#363, D16): campaign-scoped "session now" as an absolute day
-- counter. The DM advances / sets it absolutely; the host-side calendar
-- gate emits only events with start_day <= day (never the future).
CREATE TABLE IF NOT EXISTS campaign_session_now (
  campaign_id TEXT PRIMARY KEY,
  day INTEGER NOT NULL DEFAULT 0
);
