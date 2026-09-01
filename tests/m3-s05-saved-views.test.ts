// @vitest-environment node
// M3-S05: Saved views — SQLite schema + service for saving Table and Graph configs.
// See: https://github.com/Djimon/WorldBrain/issues/46

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getSavedViewsService() {
  return import('../src/services/saved-views-service');
}

async function openDb() {
  const { applySavedViewsSchema } = await import('../core_data/saved-views-schema');
  const raw = new DatabaseSync(':memory:');
  applySavedViewsSchema(raw);
  // Async DatabaseLike wrapper around the sync handle; `prepare` passthrough
  // keeps the raw schema/table assertions working.
  return {
    execute: async (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); },
    select: async <T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> =>
      raw.prepare(sql).all(...(args as never[])) as T[],
    prepare: (sql: string) => raw.prepare(sql),
  };
}

describe('M3-S05 saved views', () => {
  describe('schema', () => {
    it('applySavedViewsSchema creates the saved_views table', async () => {
      const db = await openDb();
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='saved_views'`)
        .all() as Array<{ name: string }>;
      expect(tables.length).toBe(1);
    });

    it('saved_views table has required columns', async () => {
      const db = await openDb();
      const cols = db.prepare('PRAGMA table_info(saved_views)').all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);

      expect(names).toContain('id');
      expect(names).toContain('name');
      expect(names).toContain('view_type');
      expect(names).toContain('config_json');
      expect(names).toContain('updated_at');
    });

    it('schema creation is idempotent', async () => {
      const { applySavedViewsSchema } = await import('../core_data/saved-views-schema');
      const db = new DatabaseSync(':memory:');
      applySavedViewsSchema(db);
      expect(() => applySavedViewsSchema(db)).not.toThrow();
    });
  });

  describe('saveView', () => {
    it('exports saveView function', async () => {
      const mod = await getSavedViewsService();
      expect(typeof mod.saveView).toBe('function');
    });

    it('creates a saved view record', async () => {
      const { saveView } = await getSavedViewsService();
      const db = await openDb();

      await saveView(db, {
        name: 'All Characters',
        view_type: 'table',
        config: { entityType: 'Character', columns: ['title', 'role'], filters: {}, sort: [] },
      });

      const rows = db.prepare('SELECT * FROM saved_views').all() as unknown[];
      expect(rows.length).toBe(1);
    });

    it('returns the new view id', async () => {
      const { saveView } = await getSavedViewsService();
      const db = await openDb();

      const result = await saveView(db, {
        name: 'My View',
        view_type: 'graph',
        config: { entityTypes: ['Character'], relationTypes: ['ally_of'] },
      });

      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('view_type accepts "table" and "graph"', async () => {
      const { saveView } = await getSavedViewsService();
      const db = await openDb();

      await expect(saveView(db, { name: 'Table', view_type: 'table', config: {} })).resolves.toBeDefined();
      await expect(saveView(db, { name: 'Graph', view_type: 'graph', config: {} })).resolves.toBeDefined();
    });
  });

  describe('listViews', () => {
    it('exports listViews function', async () => {
      const mod = await getSavedViewsService();
      expect(typeof mod.listViews).toBe('function');
    });

    it('returns all saved views with name, view_type, and updated_at', async () => {
      const { saveView, listViews } = await getSavedViewsService();
      const db = await openDb();

      await saveView(db, { name: 'View A', view_type: 'table', config: {} });
      await saveView(db, { name: 'View B', view_type: 'graph', config: {} });

      const views = await listViews(db);

      expect(views.length).toBe(2);
      expect(views[0]).toHaveProperty('name');
      expect(views[0]).toHaveProperty('view_type');
      expect(views[0]).toHaveProperty('updated_at');
    });
  });

  describe('loadView', () => {
    it('exports loadView function', async () => {
      const mod = await getSavedViewsService();
      expect(typeof mod.loadView).toBe('function');
    });

    it('returns the config object for a saved view', async () => {
      const { saveView, loadView } = await getSavedViewsService();
      const db = await openDb();
      const config = { entityType: 'Character', columns: ['title', 'role'] };

      const { id } = await saveView(db, { name: 'My Config', view_type: 'table', config });
      const loaded = await loadView(db, id);

      expect(loaded?.config).toMatchObject(config);
    });

    it('returns null for unknown view id', async () => {
      const { loadView } = await getSavedViewsService();
      const db = await openDb();

      expect(await loadView(db, 'nonexistent-id')).toBeNull();
    });
  });

  describe('renameView', () => {
    it('exports renameView function', async () => {
      const mod = await getSavedViewsService();
      expect(typeof mod.renameView).toBe('function');
    });

    it('updates the view name', async () => {
      const { saveView, renameView, loadView } = await getSavedViewsService();
      const db = await openDb();

      const { id } = await saveView(db, { name: 'Old Name', view_type: 'table', config: {} });
      await renameView(db, id, 'New Name');
      const view = await loadView(db, id);

      expect(view?.name).toBe('New Name');
    });
  });

  describe('deleteView', () => {
    it('exports deleteView function', async () => {
      const mod = await getSavedViewsService();
      expect(typeof mod.deleteView).toBe('function');
    });

    it('removes the view from the database', async () => {
      const { saveView, deleteView, listViews } = await getSavedViewsService();
      const db = await openDb();

      const { id } = await saveView(db, { name: 'To Delete', view_type: 'table', config: {} });
      await deleteView(db, id);

      expect((await listViews(db)).length).toBe(0);
    });
  });
});
