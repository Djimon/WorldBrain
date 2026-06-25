import type { DatabaseSync } from 'node:sqlite';

export const HANDOUT_TYPES = {
  LETTER:          'Letter',
  CLUE_SHEET:      'Clue Sheet',
  FACTION_DOSSIER: 'Faction Dossier',
  SESSION_RECAP:   'Session Recap',
  SHOP_SHEET:      'Shop Sheet',
} as const;

export type HandoutType = typeof HANDOUT_TYPES[keyof typeof HANDOUT_TYPES];

export function applyHandoutSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS handouts (
      id               TEXT PRIMARY KEY NOT NULL,
      type             TEXT NOT NULL,
      title            TEXT NOT NULL,
      source_entity_id TEXT,
      audience         TEXT NOT NULL DEFAULT 'gm',
      content_json     TEXT NOT NULL DEFAULT '{}',
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
