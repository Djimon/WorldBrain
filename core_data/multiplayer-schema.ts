// M10 rebuild: campaign bracket + roster + visibility (S20/S02/S03/S04/S07).
// Executed by src/services/db-init.ts on project open. Mirrors
// the tables in src/data/runtime/schema.sql (which only the tests load directly)
// into the app's runtime DB.
import { DatabaseSync } from 'node:sqlite';

type MpDb = InstanceType<typeof DatabaseSync>;

export function applyMultiplayerSchema(db: MpDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      world_time_start TEXT,
      active_map_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // M10-#386: active presented map (play cockpit). ALTER for existing
  // dev DBs (idempotent) — the CREATE above covers fresh DBs.
  try { db.exec(`ALTER TABLE campaigns ADD COLUMN active_map_id TEXT`); } catch { /* column already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      code TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_players (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      token_hash TEXT,
      status TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS player_groups (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      PRIMARY KEY (group_id, player_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_visibility_overrides (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      player_id TEXT,
      group_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS combat_log (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      actor_display TEXT NOT NULL,
      actor_player_id TEXT,
      text TEXT NOT NULL,
      visibility TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS whiteboards (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target_player_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS whiteboard_elements (
      id TEXT PRIMARY KEY,
      whiteboard_id TEXT NOT NULL,
      element_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // M10-D30 (#376): dedicated table for player characters; base_entities
  // stays pure world-building.
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_characters (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      sheet_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_notes (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // M10-S17 (#363, D16): campaign-scoped "session now" as an absolute
  // day counter. The DM advances / sets it absolutely; the host-side
  // calendar gate emits only events with start_day <= day.
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_session_now (
      campaign_id TEXT PRIMARY KEY,
      day INTEGER NOT NULL DEFAULT 0
    )
  `);

  // #424 (S5): time-of-day as campaign/session state (realtime 24h/12h OR abstract
  // editable phases), stored as a validated JSON blob. Separate from the calendar
  // schema by design — CalendarDate stays {year,month,day}.
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_time_of_day (
      campaign_id TEXT PRIMARY KEY,
      state TEXT NOT NULL
    )
  `);
}
