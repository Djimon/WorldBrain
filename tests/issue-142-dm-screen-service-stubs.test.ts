// @vitest-environment node
// issue #142: listScreens and getScreen are stubs — DM Screen never loads saved screens from DB
// Standalone file: the story test (m6-s09) mocks the service at module level, making it impossible
// to test the real implementation there.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

// applyDmScreenSchema moved into dm-screen-service and the whole service is now
// async against the DatabaseLike (execute/select) contract, not raw node:sqlite.
async function getDmScreenService() { return import('../src/services/dm-screen-service'); }

// Wrap an in-memory node:sqlite DatabaseSync as an async DatabaseLike.
function openDb(): DatabaseLike {
  const db = new DatabaseSync(':memory:');
  return {
    async execute(sql: string, args: unknown[] = []): Promise<void> {
      db.prepare(sql).run(...(args as never[]));
    },
    async select<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(...(args as never[])) as T[];
    },
  };
}

describe('issue #142: dm-screen-service read path (not stubs)', () => {
  it('listScreens returns screens previously saved with saveScreen', async () => {
    const { applyDmScreenSchema, saveScreen, listScreens } = await getDmScreenService();
    const db = openDb();
    await applyDmScreenSchema(db);
    await saveScreen(db, { title: 'Combat Screen', layout: { columns: 2 }, panels: [] });
    const screens = await listScreens(db);
    expect(screens.length).toBeGreaterThan(0);
    expect(screens[0].title).toBe('Combat Screen');
  });

  it('getScreen returns the screen by id', async () => {
    const { applyDmScreenSchema, saveScreen, getScreen } = await getDmScreenService();
    const db = openDb();
    await applyDmScreenSchema(db);
    const { id } = await saveScreen(db, { title: 'Travel Screen', layout: { columns: 1 }, panels: [] });
    const screen = await getScreen(db, id);
    expect(screen).not.toBeNull();
    expect(screen?.title).toBe('Travel Screen');
  });

  it('getScreen returns null for unknown id', async () => {
    const { applyDmScreenSchema, getScreen } = await getDmScreenService();
    const db = openDb();
    await applyDmScreenSchema(db);
    expect(await getScreen(db, 'nonexistent')).toBeNull();
  });

  it('listScreens returns empty array when no screens saved', async () => {
    const { applyDmScreenSchema, listScreens } = await getDmScreenService();
    const db = openDb();
    await applyDmScreenSchema(db);
    expect(await listScreens(db)).toEqual([]);
  });
});
