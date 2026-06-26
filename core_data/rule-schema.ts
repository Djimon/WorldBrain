import type { DatabaseLike } from '../src/services/entity-service';

const RULE_TYPES_REQUIRING_SUMMARY = new Set(['spell', 'ability', 'condition', 'class_feature']);

export function isRuleReferenceSummaryRequired(type: string): boolean {
  return RULE_TYPES_REQUIRING_SUMMARY.has(type);
}

export async function applyRuleSchema(db: DatabaseLike): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rule_sources (
      id          TEXT PRIMARY KEY NOT NULL,
      label       TEXT NOT NULL,
      license     TEXT NOT NULL DEFAULT '',
      url         TEXT NOT NULL DEFAULT '',
      is_read_only INTEGER NOT NULL DEFAULT 1
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rule_entities (
      id                TEXT NOT NULL,
      type              TEXT NOT NULL,
      ruleset           TEXT NOT NULL DEFAULT '',
      title             TEXT NOT NULL,
      properties_json   TEXT NOT NULL DEFAULT '{}',
      reference_summary TEXT,
      body_json         TEXT NOT NULL DEFAULT '{}',
      source_id         TEXT,
      is_homebrew       INTEGER NOT NULL DEFAULT 0,
      base_entity_id    TEXT,
      PRIMARY KEY (id, source_id),
      FOREIGN KEY (source_id) REFERENCES rule_sources(id)
    )
  `);
}
