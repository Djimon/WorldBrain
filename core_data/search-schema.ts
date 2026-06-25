// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';

type SearchDb = InstanceType<typeof DatabaseSync>;

export interface SearchEntry {
  entity_id: string;
  entity_type?: string;
  title: string;
  aliases: string;
  summary: string;
  body: string;
  tags: string;
  properties_text: string;
}

export function applySearchSchema(db: SearchDb): void {
  const existing = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='entity_search'`)
    .get();
  if (!existing) {
    db.exec(`
      CREATE VIRTUAL TABLE entity_search USING fts5(
        title,
        aliases,
        summary,
        body,
        tags,
        properties_text,
        entity_id UNINDEXED,
        entity_type UNINDEXED
      )
    `);
  }
}

export function indexEntity(db: SearchDb, entry: SearchEntry): void {
  db.prepare(`DELETE FROM entity_search WHERE entity_id = ?`).run(entry.entity_id);
  db.prepare(
    `INSERT INTO entity_search(entity_id, entity_type, title, aliases, summary, body, tags, properties_text)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    entry.entity_id,
    entry.entity_type ?? '',
    entry.title,
    entry.aliases,
    entry.summary,
    entry.body,
    entry.tags,
    entry.properties_text,
  );
}

export function removeEntityFromIndex(db: SearchDb, entityId: string): void {
  db.prepare(`DELETE FROM entity_search WHERE entity_id = ?`).run(entityId);
}

export function rebuildSearchIndex(db: SearchDb): void {
  db.exec(`DELETE FROM entity_search`);
  const entities = db
    .prepare(
      `SELECT id, title, aliases_json, summary, body_json, properties_json FROM base_entities`,
    )
    .all() as Array<{
    id: string;
    title: string;
    aliases_json: string;
    summary: string;
    body_json: string;
    properties_json: string;
  }>;
  for (const e of entities) {
    let aliases = '';
    try {
      aliases = (JSON.parse(e.aliases_json) as string[]).join(' ');
    } catch (err) {
      throw new Error(`rebuildSearchIndex: malformed aliases_json for entity ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    let body = '';
    try {
      const doc = JSON.parse(e.body_json) as { blocks?: Array<{ text?: string }> };
      body = (doc.blocks ?? [])
        .map((b) => b.text ?? '')
        .join(' ');
    } catch (err) {
      throw new Error(`rebuildSearchIndex: malformed body_json for entity ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    indexEntity(db, {
      entity_id: e.id,
      title: e.title ?? '',
      aliases,
      summary: e.summary ?? '',
      body,
      tags: '',
      properties_text: '',
    });
  }
}
