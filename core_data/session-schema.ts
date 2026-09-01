import { DatabaseSync } from 'node:sqlite';

type Db = InstanceType<typeof DatabaseSync>;

export function applySessionSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      title TEXT NOT NULL,
      world_time_start INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_variables (
      id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT 'null',
      default_value TEXT NOT NULL DEFAULT 'null',
      allow_global_override INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS global_variables (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT 'null',
      default_value TEXT NOT NULL DEFAULT 'null'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS capture_notes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'needs_processing',
      links_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    )
  `);

  // M13-S01: rule_modules — named, shareable overlays.
  db.exec(`
    CREATE TABLE IF NOT EXISTS rule_modules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_system_id TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rule_module_entries (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      target TEXT NOT NULL,
      op TEXT NOT NULL,
      value_json TEXT NOT NULL DEFAULT 'null'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_ad_hoc_overrides (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      target TEXT NOT NULL,
      op TEXT NOT NULL,
      value_json TEXT NOT NULL DEFAULT 'null',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // M13-S04 (#239): house-rule overlay modules activated per session.
  // Ordering via display_order (smallest first); enabled = 0 pauses
  // a module without losing the entry.
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_active_overlays (
      session_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (session_id, module_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_log (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      prev_value TEXT,
      created_at TEXT NOT NULL
    )
  `);
}
