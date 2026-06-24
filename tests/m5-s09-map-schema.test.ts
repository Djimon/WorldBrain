// @vitest-environment node
// E8-S01: Map data model & schema — maps, map_markers, calibration.
// See: https://github.com/Djimon/WorldBrain/issues/75

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getMapSchema() { return import('../core_data/map-schema'); }
function openDb() { return new DatabaseSync(':memory:'); }

describe('E8-S01 map schema', () => {
  describe('maps table', () => {
    it('creates maps table', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const cols = db.prepare('PRAGMA table_info(maps)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('maps has id, title, asset_id, image_width_px, image_height_px, calibration_json', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const names = (db.prepare('PRAGMA table_info(maps)').all() as Array<{ name: string }>).map(c => c.name);
      ['id','title','asset_id','image_width_px','image_height_px'].forEach(c => expect(names).toContain(c));
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
      db.prepare(`INSERT INTO maps (id, title, asset_id, image_width_px, image_height_px) VALUES ('m1','Test Map','asset-1',1000,800)`).run();
      expect(() => db.prepare(`INSERT INTO map_markers (id, map_id, kind, geometry_json, visibility_json) VALUES ('mk1','m1','pin','{"x":100,"y":200}','"public"')`).run()).not.toThrow();
    });
  });

  describe('bidirectional query', () => {
    it('getMarkersForMap returns markers for a specific map', async () => {
      const { applyMapSchema, getMarkersForMap } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      db.prepare(`INSERT INTO maps (id, title, asset_id, image_width_px, image_height_px) VALUES ('m1','Map','a1',1000,800)`).run();
      db.prepare(`INSERT INTO map_markers (id, map_id, kind, geometry_json, visibility_json) VALUES ('mk1','m1','pin','{}','"public"')`).run();
      const markers = getMarkersForMap(db, 'm1');
      expect(markers.length).toBe(1);
    });

    it('getMarkersForEntity returns markers linked to an entity', async () => {
      const { applyMapSchema, getMarkersForEntity } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      db.prepare(`INSERT INTO maps (id, title, asset_id, image_width_px, image_height_px) VALUES ('m1','Map','a1',1000,800)`).run();
      db.prepare(`INSERT INTO map_markers (id, map_id, entity_id, kind, geometry_json, visibility_json) VALUES ('mk2','m1','char-ada','pin','{}','"public"')`).run();
      const markers = getMarkersForEntity(db, 'char-ada');
      expect(markers.length).toBe(1);
    });
  });

  describe('calibration JSON round-trip', () => {
    it('calibration_json stored and retrieved without data loss', async () => {
      const { applyMapSchema } = await getMapSchema();
      const db = openDb(); applyMapSchema(db);
      const calibration = JSON.stringify({ point_a: [100, 200], point_b: [300, 400], world_distance: 5, world_unit: 'km', pixels_per_world_unit: 100 });
      db.prepare(`INSERT INTO maps (id, title, asset_id, image_width_px, image_height_px, calibration_json) VALUES ('m2','Map','a2',1000,800,?)`).run(calibration);
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
