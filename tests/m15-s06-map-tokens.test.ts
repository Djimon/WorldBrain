// @vitest-environment node
// M15-S06: map_tokens Schema & Service — bewegliche Session-Tokens
// See: https://github.com/Djimon/WorldBrain/issues/278
//
// Note: pure DatabaseLike service module — AP-001 satisfied structurally
// (every function takes DatabaseLike); not separately re-tested.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyMapSchema } from '../core_data/map-schema';
import type { DatabaseLike } from '../src/services/entity-service';

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

async function getMapTokenService() { return import('../src/services/map-token-service'); }
async function getMapLayerService() { return import('../src/services/map-layer-service'); }

describe('M15-S06 map_tokens schema & service', () => {
  describe('table shape', () => {
    it('creates a map_tokens table with exactly the specified columns', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(map_tokens)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols.sort()).toEqual(
          ['id', 'layer_id', 'map_id', 'art_asset_id', 'render_style', 'art_offset_x', 'art_offset_y', 'scale', 'label', 'x', 'y', 'ring_color', 'counter_label', 'counter_value', 'status_chips_json', 'session_id', 'created_at'].sort(),
        );
      } finally {
        db.close();
      }
    });
  });

  describe('createToken', () => {
    it('creates a token with an id prefixed token_', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken } = await getMapTokenService();
      try {
        const { id } = await createToken(asyncDb, { map_id: 'map-1', x: 10, y: 20 });
        expect(id).toMatch(/^token_/);
      } finally {
        db.close();
      }
    });

    it('creates a token layer on first use when the map has none', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken } = await getMapTokenService();
      const { listLayers } = await getMapLayerService();
      try {
        await createToken(asyncDb, { map_id: 'map-1', x: 10, y: 20 });
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers.some((l) => l.layer_type === 'token')).toBe(true);
      } finally {
        db.close();
      }
    });

    it('reuses an existing token layer instead of creating a second one', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken } = await getMapTokenService();
      const { listLayers } = await getMapLayerService();
      try {
        await createToken(asyncDb, { map_id: 'map-1', x: 10, y: 20 });
        await createToken(asyncDb, { map_id: 'map-1', x: 30, y: 40 });
        const layers = await listLayers(asyncDb, 'map-1');
        expect(layers.filter((l) => l.layer_type === 'token')).toHaveLength(1);
      } finally {
        db.close();
      }
    });
  });

  describe('status_chips_json: parsed with a safe fallback to []', () => {
    it('setStatusChips persists chips readable via listTokens', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken, setStatusChips, listTokens } = await getMapTokenService();
      try {
        const { id } = await createToken(asyncDb, { map_id: 'map-1', x: 0, y: 0 });
        await setStatusChips(asyncDb, id, [{ icon: 'poison', color: 'green', text: 'Poisoned' }]);
        const tokens = await listTokens(asyncDb, 'map-1');
        expect(tokens.find((t) => t.id === id)?.status_chips).toEqual([{ icon: 'poison', color: 'green', text: 'Poisoned' }]);
      } finally {
        db.close();
      }
    });

    it('malformed status_chips_json in the DB falls back to []', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken, listTokens } = await getMapTokenService();
      try {
        const { id } = await createToken(asyncDb, { map_id: 'map-1', x: 0, y: 0 });
        db.prepare('UPDATE map_tokens SET status_chips_json = ? WHERE id = ?').run('not json', id);
        const tokens = await listTokens(asyncDb, 'map-1');
        expect(tokens.find((t) => t.id === id)?.status_chips).toEqual([]);
      } finally {
        db.close();
      }
    });
  });

  describe('moveToken', () => {
    it('updates x/y', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken, moveToken, listTokens } = await getMapTokenService();
      try {
        const { id } = await createToken(asyncDb, { map_id: 'map-1', x: 0, y: 0 });
        await moveToken(asyncDb, id, 55, 77);
        const tokens = await listTokens(asyncDb, 'map-1');
        const token = tokens.find((t) => t.id === id);
        expect(token?.x).toBe(55);
        expect(token?.y).toBe(77);
      } finally {
        db.close();
      }
    });
  });

  describe('setCounter', () => {
    it('persists counter_label and counter_value', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken, setCounter, listTokens } = await getMapTokenService();
      try {
        const { id } = await createToken(asyncDb, { map_id: 'map-1', x: 0, y: 0 });
        await setCounter(asyncDb, id, { counter_label: 'HP', counter_value: 12 });
        const tokens = await listTokens(asyncDb, 'map-1');
        const token = tokens.find((t) => t.id === id);
        expect(token?.counter_label).toBe('HP');
        expect(token?.counter_value).toBe(12);
      } finally {
        db.close();
      }
    });
  });

  describe('listTokens session scoping', () => {
    it('a session-scoped token only appears when listing that session', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken, listTokens } = await getMapTokenService();
      try {
        await createToken(asyncDb, { map_id: 'map-1', x: 0, y: 0, session_id: 'session-a' });
        await createToken(asyncDb, { map_id: 'map-1', x: 1, y: 1 }); // base placement, no session
        const sessionATokens = await listTokens(asyncDb, 'map-1', 'session-a');
        const sessionBTokens = await listTokens(asyncDb, 'map-1', 'session-b');
        expect(sessionATokens.length).toBeGreaterThanOrEqual(1);
        expect(sessionBTokens.some((t) => t.session_id === 'session-a')).toBe(false);
      } finally {
        db.close();
      }
    });
  });

  describe('deleteToken', () => {
    it('removes the token', async () => {
      const { db, asyncDb } = createDatabase();
      const { createToken, deleteToken, listTokens } = await getMapTokenService();
      try {
        const { id } = await createToken(asyncDb, { map_id: 'map-1', x: 0, y: 0 });
        await deleteToken(asyncDb, id);
        const tokens = await listTokens(asyncDb, 'map-1');
        expect(tokens.find((t) => t.id === id)).toBeUndefined();
      } finally {
        db.close();
      }
    });
  });
});
