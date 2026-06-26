// @vitest-environment node
// issue #142: listScreens and getScreen are stubs — DM Screen never loads saved screens from DB
// Standalone file: the story test (m6-s09) mocks the service at module level, making it impossible
// to test the real implementation there.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getDmScreenService() { return import('../src/services/dm-screen-service'); }
async function getDmScreenSchema() { return import('../core_data/dm-screen-schema'); }

function openDb() { return new DatabaseSync(':memory:'); }

describe('issue #142: dm-screen-service read path (not stubs)', () => {
  it('listScreens returns screens previously saved with saveScreen', async () => {
    const { applyDmScreenSchema } = await getDmScreenSchema();
    const { saveScreen, listScreens } = await getDmScreenService();
    const db = openDb();
    applyDmScreenSchema(db);
    saveScreen(db, { title: 'Combat Screen', layout: { columns: 2 }, panels: [] });
    const screens = listScreens(db);
    expect(screens.length).toBeGreaterThan(0);
    expect(screens[0].title).toBe('Combat Screen');
  });

  it('getScreen returns the screen by id', async () => {
    const { applyDmScreenSchema } = await getDmScreenSchema();
    const { saveScreen, getScreen } = await getDmScreenService();
    const db = openDb();
    applyDmScreenSchema(db);
    const { id } = saveScreen(db, { title: 'Travel Screen', layout: { columns: 1 }, panels: [] });
    const screen = getScreen(db, id);
    expect(screen).not.toBeNull();
    expect(screen?.title).toBe('Travel Screen');
  });

  it('getScreen returns null for unknown id', async () => {
    const { applyDmScreenSchema } = await getDmScreenSchema();
    const { getScreen } = await getDmScreenService();
    const db = openDb();
    applyDmScreenSchema(db);
    expect(getScreen(db, 'nonexistent')).toBeNull();
  });

  it('listScreens returns empty array when no screens saved', async () => {
    const { applyDmScreenSchema } = await getDmScreenSchema();
    const { listScreens } = await getDmScreenService();
    const db = openDb();
    applyDmScreenSchema(db);
    expect(listScreens(db)).toEqual([]);
  });
});
