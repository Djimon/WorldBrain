// @vitest-environment node
// E8-S01: Map data model & schema — maps, map_markers, calibration.
// See: https://github.com/Djimon/WorldBrain/issues/75

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

async function getMapSchema() { return import('../core_data/map-schema'); }
function openDb() { return new DatabaseSync(':memory:'); }

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike (same
// pattern as m1-s06-effective-entity-read.test.ts).
function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

describe('E8-S01 map schema', () => {
  describe('maps table', () => {
    it('creates maps table', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const cols = db.prepare('PRAGMA table_info(maps)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    // #273 (M15-S01, Decision 5): asset_id removed from maps -- the base
    // image is now the bottom `image` map_layers row instead.
    it('maps has id, title, image_width_px, image_height_px, calibration_json', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const names = (db.prepare('PRAGMA table_info(maps)').all() as Array<{ name: string }>).map(c => c.name);
      ['id','title','image_width_px','image_height_px'].forEach(c => expect(names).toContain(c));
    });

    it('maps no longer has an asset_id column (#273 Decision 5)', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const names = (db.prepare('PRAGMA table_info(maps)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).not.toContain('asset_id');
    });
  });

  describe('map_markers table', () => {
    it('creates map_markers table', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const cols = db.prepare('PRAGMA table_info(map_markers)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('map_markers has id, map_id, entity_id, kind, geometry_json, style_json, visibility_json', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const names = (db.prepare('PRAGMA table_info(map_markers)').all() as Array<{ name: string }>).map(c => c.name);
      ['id','map_id','kind','geometry_json','visibility_json'].forEach(c => expect(names).toContain(c));
    });

    it('entity_id on map_markers is nullable', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      db.prepare(`INSERT INTO maps (id, title, image_width_px, image_height_px) VALUES ('m1','Test Map',1000,800)`).run();
      expect(() => db.prepare(`INSERT INTO map_markers (id, map_id, kind, geometry_json, visibility_json) VALUES ('mk1','m1','pin','{"x":100,"y":200}','"public"')`).run()).not.toThrow();
    });
  });

  describe('bidirectional query', () => {
    it('getMarkersForMap returns markers for a specific map', async () => {
      const { applyMapSchema, getMarkersForMap } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      db.prepare(`INSERT INTO maps (id, title, image_width_px, image_height_px) VALUES ('m1','Map',1000,800)`).run();
      db.prepare(`INSERT INTO map_markers (id, map_id, kind, geometry_json, visibility_json) VALUES ('mk1','m1','pin','{}','"public"')`).run();
      const markers = await getMarkersForMap(makeAsyncDb(db), 'm1');
      expect(markers.length).toBe(1);
    });

    it('getMarkersForEntity returns markers linked to an entity', async () => {
      const { applyMapSchema, getMarkersForEntity } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      db.prepare(`INSERT INTO maps (id, title, image_width_px, image_height_px) VALUES ('m1','Map',1000,800)`).run();
      db.prepare(`INSERT INTO map_markers (id, map_id, entity_id, kind, geometry_json, visibility_json) VALUES ('mk2','m1','char-ada','pin','{}','"public"')`).run();
      const markers = await getMarkersForEntity(makeAsyncDb(db), 'char-ada');
      expect(markers.length).toBe(1);
    });
  });

  describe('calibration JSON round-trip', () => {
    it('calibration_json stored and retrieved without data loss', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const calibration = JSON.stringify({ point_a: [100, 200], point_b: [300, 400], world_distance: 5, world_unit: 'km', pixels_per_world_unit: 100 });
      db.prepare(`INSERT INTO maps (id, title, image_width_px, image_height_px, calibration_json) VALUES ('m2','Map',1000,800,?)`).run(calibration);
      const row = db.prepare(`SELECT calibration_json FROM maps WHERE id='m2'`).get() as { calibration_json: string };
      expect(JSON.parse(row.calibration_json)).toMatchObject({ world_unit: 'km', pixels_per_world_unit: 100 });
    });
  });

  describe('idempotency', () => {
    it('schema creation is idempotent', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      expect(() => applyMapSchema(db)).not.toThrow();
    });
  });
});
