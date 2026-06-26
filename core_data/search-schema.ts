import type { DatabaseLike } from '../src/services/entity-service';

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

export async function applySearchSchema(db: DatabaseLike): Promise<void> {
  const existing = await db.select<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='entity_search'`,
  );
  if (existing.length === 0) {
    await db.execute(`
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

export async function indexEntity(db: DatabaseLike, entry: SearchEntry): Promise<void> {
  await db.execute(`DELETE FROM entity_search WHERE entity_id = ?`, [entry.entity_id]);
  await db.execute(
    `INSERT INTO entity_search(entity_id, entity_type, title, aliases, summary, body, tags, properties_text)
     VALUES (?,?,?,?,?,?,?,?)`,
    [entry.entity_id, entry.entity_type ?? '', entry.title, entry.aliases, entry.summary, entry.body, entry.tags, entry.properties_text],
  );
}

export async function removeEntityFromIndex(db: DatabaseLike, entityId: string): Promise<void> {
  await db.execute(`DELETE FROM entity_search WHERE entity_id = ?`, [entityId]);
}

export async function rebuildSearchIndex(db: DatabaseLike): Promise<void> {
  await db.execute(`DELETE FROM entity_search`);
  const entities = await db.select<{
    id: string;
    title: string;
    aliases_json: string;
    summary: string;
    body_json: string;
    properties_json: string;
  }>(
    `SELECT id, title, aliases_json, summary, body_json, properties_json FROM base_entities`,
  );
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

    await indexEntity(db, {
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
