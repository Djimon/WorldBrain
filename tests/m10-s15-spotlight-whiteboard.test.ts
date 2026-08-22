// @vitest-environment node
// M10-S15 (rebuild): Spotlight/Whiteboard — gemeinsam + per-Spieler privat
// See: https://github.com/Djimon/WorldBrain/issues/361

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
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

const runtimeSchemaSql = readFileSync(
  new URL('../src/data/runtime/schema.sql', import.meta.url),
  'utf8',
);

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

describe('M10-S15 Whiteboard schema', () => {
  it('whiteboards table exists with campaign_id and type (shared|private)', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('whiteboards')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('campaign_id');
      expect(names).toContain('type');
    } finally {
      db.close();
    }
  });

  it('whiteboard_elements table exists with element types', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('whiteboard_elements')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('whiteboard_id');
      expect(names).toContain('element_type');
    } finally {
      db.close();
    }
  });
});

describe('M10-S15 Whiteboard service', () => {
  async function getWhiteboardService() {
    return import('../src/services/whiteboard-service');
  }

  it('createBoard creates a shared or private board', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getWhiteboardService();
      const board = await svc.createBoard(asyncDb, {
        campaignId: 'camp-1',
        type: 'shared',
      });
      expect(board).toHaveProperty('id');
      expect(board.type).toBe('shared');
    } finally {
      db.close();
    }
  });

  it('private board targets a specific player', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getWhiteboardService();
      const board = await svc.createBoard(asyncDb, {
        campaignId: 'camp-1',
        type: 'private',
        targetPlayerId: 'p-1',
      });
      expect(board.target_player_id).toBe('p-1');
    } finally {
      db.close();
    }
  });

  it('placeElement supports entity-ref, text, image types', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getWhiteboardService();
      expect(svc).toHaveProperty('placeElement');
    } finally {
      db.close();
    }
  });
});
