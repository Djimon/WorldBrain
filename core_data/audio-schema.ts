// M15-S11 (#282): audio_scenes / audio_channels / audio_presets — persistent
// data model for EPIC-024's soundboard. Shared SQLite DB, no separate audio DB.
import { DatabaseSync } from 'node:sqlite';

type AudioDb = InstanceType<typeof DatabaseSync>;

export function applyAudioSchema(db: AudioDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_scenes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_channels (
      id TEXT PRIMARY KEY NOT NULL,
      scene_id TEXT NOT NULL,
      name TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'replace',
      volume REAL NOT NULL DEFAULT 1,
      balance REAL NOT NULL DEFAULT 0,
      eq_low REAL NOT NULL DEFAULT 0,
      eq_mid REAL NOT NULL DEFAULT 0,
      eq_high REAL NOT NULL DEFAULT 0,
      transition_type TEXT NOT NULL DEFAULT 'fade',
      transition_seconds REAL NOT NULL DEFAULT 2,
      muted INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_presets (
      id TEXT PRIMARY KEY NOT NULL,
      channel_id TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      base_volume REAL NOT NULL DEFAULT 1,
      label TEXT,
      icon TEXT,
      color TEXT,
      loop INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
