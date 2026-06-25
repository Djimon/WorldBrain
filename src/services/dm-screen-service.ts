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

export function listScreens(_db?: DatabaseLike): DmScreenRecord[] {
  return [];
}

export function getScreen(_db: DatabaseLike | undefined, _id: string): DmScreenRecord | null {
  return null;
}

export function saveScreen(db: DatabaseLike, screen: Omit<DmScreenRecord, 'id'>): { id: string } {
  const id = `screen-${Date.now()}`;
  db.prepare(`INSERT OR REPLACE INTO gm_screens (id, title, layout, panels) VALUES (?, ?, ?, ?)`).run(
    id, screen.title, JSON.stringify(screen.layout), JSON.stringify(screen.panels),
  );
  return { id };
}
