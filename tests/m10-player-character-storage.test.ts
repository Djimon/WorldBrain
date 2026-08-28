// @vitest-environment node
// M10 fix(P0): Player-Charaktere raus aus base_entities (#376, D30)
// See: https://github.com/Djimon/WorldBrain/issues/376

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
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

describe('#376 player_characters table', () => {
  it('schema includes player_characters table', () => {
    const schema = readFileSync('src/data/runtime/schema.sql', 'utf-8');
    expect(schema).toMatch(/CREATE TABLE.*player_characters/i);
  });

  it('player_characters has campaign_id, player_id, sheet_json', () => {
    const schema = readFileSync('src/data/runtime/schema.sql', 'utf-8');
    const tableMatch = schema.match(/CREATE TABLE.*player_characters[^;]+/is);
    expect(tableMatch).toBeTruthy();
    const tableDef = tableMatch![0];
    expect(tableDef).toMatch(/campaign_id/);
    expect(tableDef).toMatch(/player_id/);
    expect(tableDef).toMatch(/sheet_json/);
  });
});

describe('#376 player-character-service writes to own table', () => {
  async function getService() {
    return import('../src/services/player-character-service');
  }

  it('createPlayerCharacter writes to player_characters, not base_entities', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.createPlayerCharacter(asyncDb, {
        campaignId: 'c1',
        playerId: 'p1',
        sheetJson: { name: 'Thorn', class: 'Fighter' },
      });
      const rows = await asyncDb.select<{ id: string }>(
        'SELECT id FROM player_characters WHERE campaign_id = ?',
        ['c1'],
      );
      expect(rows).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it('no player character in base_entities after creation', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.createPlayerCharacter(asyncDb, {
        campaignId: 'c1',
        playerId: 'p1',
        sheetJson: { name: 'Thorn' },
      });
      const entities = await asyncDb.select<{ id: string }>(
        "SELECT id FROM base_entities WHERE type = 'Character'",
      );
      expect(entities).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});

describe('#376 Guard: no is_player_character in base_entities paths', () => {
  it('entity-service does not reference is_player_character', () => {
    const source = readFileSync('src/services/entity-service.ts', 'utf-8');
    expect(source).not.toMatch(/is_player_character/);
  });
});
