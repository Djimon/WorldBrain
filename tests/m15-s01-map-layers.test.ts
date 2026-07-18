// @vitest-environment node
// M15-S01: map_layers Schema & Migration — Layer als Basis-Primitiv
// See: https://github.com/Djimon/WorldBrain/issues/273
//
// Note: pure DatabaseLike service module (no UI component in this story's
// Unit-Tests bullet) — the generic AP-001 "database prop typed as
// DatabaseLike" requirement is satisfied structurally (every function takes
// DatabaseLike, no unknown/as-never casts at call sites); not separately
// re-tested to avoid fabricating a non-existent requirement (AGENTS.md: no
// extrapolation).

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyMapSchema } from '../core_data/map-schema';
import type { DatabaseLike } from '../src/services/entity-service';

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike (same
// pattern as m1-s06-effective-entity-read.test.ts).
function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  applyMapSchema(raw);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

async function getMapLayerService() { return import('../src/services/map-layer-service'); }

describe('M15-S01 map_layers schema & service', () => {
  describe('table shape', () => {
    it('creates a map_layers table with exactly the specified columns', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(map_layers)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols.sort()).toEqual(
          ['asset_id', 'created_at', 'id', 'layer_type', 'map_id', 'mask_data', 'name', 'offset_x', 'offset_y', 'opacity', 'player_visible', 'visible', 'z_order'].sort(),
        );
      } finally {
        db.close();
      }
    });

    it('applying the schema twice does not throw (idempotent)', () => {
      const { db } = createDatabase();
      try {
        expect(() => applyMapSchema(db)).not.toThrow();
      } finally {
        db.close();
      }
    });
  });

  describe('createLayer', () => {
    it('creates a layer with an id prefixed layer_', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer } = await getMapLayerService();
      try {
        const { id } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'image', asset_id: 'asset-1' });
        expect(id).toMatch(/^layer_/);
      } finally {
        db.close();
      }
    });

    it('clamps opacity above 1 down to 1', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer, listLayers } = await getMapLayerService();
      try {
        await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'image', opacity: 5 });
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers[0].opacity).toBe(1);
      } finally {
        db.close();
      }
    });

    it('clamps opacity below 0 up to 0', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer, listLayers } = await getMapLayerService();
      try {
        await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'fog', opacity: -2 });
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers[0].opacity).toBe(0);
      } finally {
        db.close();
      }
    });
  });

  describe('listLayers ordered by z_order ascending', () => {
    it('returns layers sorted by z_order, not insertion order', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer, reorderLayers, listLayers } = await getMapLayerService();
      try {
        const { id: top } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'image', name: 'Top' });
        const { id: bottom } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'image', name: 'Bottom' });
        await reorderLayers(asyncDb, 'map-1', [bottom, top]);
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers.map((l) => l.name)).toEqual(['Bottom', 'Top']);
      } finally {
        db.close();
      }
    });
  });

  describe('updateLayer', () => {
    it('patches name/opacity/visible/player_visible/mask_data', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer, updateLayer, listLayers } = await getMapLayerService();
      try {
        const { id } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'fog' });
        await updateLayer(asyncDb, id, { name: 'Fog A', opacity: 0.5, visible: false, player_visible: true, mask_data: 'data:image/png;base64,abc' });
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers[0]).toMatchObject({ name: 'Fog A', opacity: 0.5, visible: 0, player_visible: 1, mask_data: 'data:image/png;base64,abc' });
      } finally {
        db.close();
      }
    });

    it('clamps a patched opacity to [0, 1]', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer, updateLayer, listLayers } = await getMapLayerService();
      try {
        const { id } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'image' });
        await updateLayer(asyncDb, id, { opacity: 3 });
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers[0].opacity).toBe(1);
      } finally {
        db.close();
      }
    });
  });

  describe('deleteLayer', () => {
    it('removes the layer', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer, deleteLayer, listLayers } = await getMapLayerService();
      try {
        const { id } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'token' });
        await deleteLayer(asyncDb, id);
        expect(await listLayers(asyncDb, 'map-1')).toEqual([]);
      } finally {
        db.close();
      }
    });
  });

  describe('reorderLayers writes contiguous z_order 0..n by array index', () => {
    it('assigns z_order 0, 1, 2 matching the given order', async () => {
      const { db, asyncDb } = createDatabase();
      const { createLayer, reorderLayers, listLayers } = await getMapLayerService();
      try {
        const { id: a } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'image', name: 'A' });
        const { id: b } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'fog', name: 'B' });
        const { id: c } = await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'token', name: 'C' });
        await reorderLayers(asyncDb, 'map-1', [c, a, b]);
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers.map((l) => [l.name, l.z_order])).toEqual([['C', 0], ['A', 1], ['B', 2]]);
      } finally {
        db.close();
      }
    });
  });

  describe('#273 (partial, flagged): maps.asset_id removal + auto image-layer on map creation', () => {
    // Scope note: removing maps.asset_id and rewiring createMap/importMapImage
    // (map-service.ts) + MapViewer.tsx to read the bottom image layer instead
    // is a cross-cutting change touching several already-working modules —
    // Implementation Agent scope, not a throwing-stub addition. Pinned here
    // as RED against the CURRENT (pre-migration) schema/service.
    it('maps table no longer has an asset_id column', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(maps)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols).not.toContain('asset_id');
      } finally {
        db.close();
      }
    });

    it('creating a map inserts exactly one image layer with z_order=0 holding the base image', async () => {
      const { db, asyncDb } = createDatabase();
      const { createMap } = await import('../src/services/map-service');
      const { listLayers } = await getMapLayerService();
      try {
        const { id } = await createMap(asyncDb, { title: 'Test Map', asset_id: 'assets/base.png' });
        const layers = await listLayers(asyncDb, id);
        expect(layers).toHaveLength(1);
        expect(layers[0]).toMatchObject({ layer_type: 'image', asset_id: 'assets/base.png', z_order: 0 });
      } finally {
        db.close();
      }
    });
  });
});
