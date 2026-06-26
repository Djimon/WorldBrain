import type { DatabaseLike } from './entity-service';

export interface DmPanel {
  id: string;
  title: string;
  source: 'rule_table' | 'entity_type' | 'saved_view' | 'static_entity';
  config: Record<string, unknown>;
  display: 'list' | 'card' | 'table';
}

export interface DmScreenRecord {
  id: string;
  title: string;
  layout: { columns: number };
  panels: DmPanel[];
}

export async function applyDmScreenSchema(db: DatabaseLike): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS gm_screens (
      id      TEXT PRIMARY KEY NOT NULL,
      title   TEXT NOT NULL,
      layout  TEXT NOT NULL DEFAULT '{"columns":2}',
      panels  TEXT NOT NULL DEFAULT '[]'
    )
  `);
}

export async function listScreens(db?: DatabaseLike): Promise<DmScreenRecord[]> {
  if (!db) return [];
  const rows = await db.select<{ id: string; title: string; layout: string; panels: string }>(
    `SELECT id, title, layout, panels FROM gm_screens`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    layout: JSON.parse(r.layout) as { columns: number },
    panels: JSON.parse(r.panels) as DmPanel[],
  }));
}

export async function getScreen(db: DatabaseLike | undefined, id: string): Promise<DmScreenRecord | null> {
  if (!db) return null;
  const rows = await db.select<{ id: string; title: string; layout: string; panels: string }>(
    `SELECT id, title, layout, panels FROM gm_screens WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    layout: JSON.parse(row.layout) as { columns: number },
    panels: JSON.parse(row.panels) as DmPanel[],
  };
}

export async function saveScreen(db: DatabaseLike, screen: Omit<DmScreenRecord, 'id'>): Promise<{ id: string }> {
  const id = `screen-${Date.now()}`;
  await db.execute(
    `INSERT OR REPLACE INTO gm_screens (id, title, layout, panels) VALUES (?, ?, ?, ?)`,
    [id, screen.title, JSON.stringify(screen.layout), JSON.stringify(screen.panels)],
  );
  return { id };
}
