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

export function applyDmScreenSchema(db: DatabaseLike): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS gm_screens (
      id      TEXT PRIMARY KEY NOT NULL,
      title   TEXT NOT NULL,
      layout  TEXT NOT NULL DEFAULT '{"columns":2}',
      panels  TEXT NOT NULL DEFAULT '[]'
    )
  `).run();
}

export function listScreens(db?: DatabaseLike): DmScreenRecord[] {
  if (!db) return [];
  const rows = db.prepare(`SELECT id, title, layout, panels FROM gm_screens`).all() as Array<{
    id: string; title: string; layout: string; panels: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    layout: JSON.parse(r.layout) as { columns: number },
    panels: JSON.parse(r.panels) as DmPanel[],
  }));
}

export function getScreen(db: DatabaseLike | undefined, id: string): DmScreenRecord | null {
  if (!db) return null;
  const row = db.prepare(`SELECT id, title, layout, panels FROM gm_screens WHERE id = ?`).get(id) as {
    id: string; title: string; layout: string; panels: string;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    layout: JSON.parse(row.layout) as { columns: number },
    panels: JSON.parse(row.panels) as DmPanel[],
  };
}

export function saveScreen(db: DatabaseLike, screen: Omit<DmScreenRecord, 'id'>): { id: string } {
  const id = `screen-${Date.now()}`;
  db.prepare(`INSERT OR REPLACE INTO gm_screens (id, title, layout, panels) VALUES (?, ?, ?, ?)`).run(
    id, screen.title, JSON.stringify(screen.layout), JSON.stringify(screen.panels),
  );
  return { id };
}
