// @vitest-environment node
// M10 fix(P0): DB-loser Client-Store + Membran-Guard (#374, D29/R3)
// See: https://github.com/Djimon/WorldBrain/issues/374

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#374 Client-Store implementation', () => {
  it('play-client-store.ts has working implementation (not just interface)', () => {
    const source = readFileSync('src/services/play-client-store.ts', 'utf-8');
    expect(source).toMatch(/applySnapshot|applyDelta|handleSnapshot/);
  });

  it('no database/useDatabase import in client store', () => {
    const source = readFileSync('src/services/play-client-store.ts', 'utf-8');
    expect(source).not.toMatch(/useDatabase|from.*DatabaseContext/);
    expect(source).not.toMatch(/import.*DatabaseLike/);
  });
});

describe('#374 Client-Mode view guards (no DB access)', () => {
  it('PlayModeView (client path) does not import database', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).not.toMatch(/useDatabase|listEntitiesByType/);
  });

  it('PlayerCharacterSheet does not use database for rendering', () => {
    const source = readFileSync('src/ui/PlayerCharacterSheet.tsx', 'utf-8');
    expect(source).not.toMatch(/useDatabase/);
  });
});

describe('#374 Offline state', () => {
  async function createStore() {
    const mod = await import('../src/services/play-client-store');
    return mod.createPlayClientStore();
  }

  it('store without snapshot shows offline/empty state', async () => {
    const store = await createStore();
    expect(store.getEntities()).toHaveLength(0);
    expect(store.isOffline()).toBe(true);
  });
});
