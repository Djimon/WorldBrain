// @vitest-environment node
// M10 fix(P0): Play-Sync-Protokoll + Client-Store-Contract (#372, D29-Anker)
// See: https://github.com/Djimon/WorldBrain/issues/372

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#372 play-sync-protocol types', () => {
  it('play-sync-protocol.ts exists and exports message types', () => {
    const source = readFileSync('src/services/play-sync-protocol.ts', 'utf-8');
    expect(source).toMatch(/export.*Snapshot/);
    expect(source).toMatch(/export.*Delta/);
    expect(source).toMatch(/export.*ClientAction/);
  });

  it('no database/useDatabase import in protocol module', () => {
    const source = readFileSync('src/services/play-sync-protocol.ts', 'utf-8');
    expect(source).not.toMatch(/useDatabase|DatabaseLike|from.*database/i);
  });
});

describe('#372 play-client-store interface', () => {
  it('play-client-store.ts exists and exports PlayClientStore', () => {
    const source = readFileSync('src/services/play-client-store.ts', 'utf-8');
    expect(source).toMatch(/export.*PlayClientStore/);
  });

  it('no database/useDatabase import in client store', () => {
    const source = readFileSync('src/services/play-client-store.ts', 'utf-8');
    expect(source).not.toMatch(/useDatabase|DatabaseLike|from.*database/i);
  });

  it('store interface accepts Snapshot and Delta', () => {
    const source = readFileSync('src/services/play-client-store.ts', 'utf-8');
    expect(source).toMatch(/Snapshot/);
    expect(source).toMatch(/Delta/);
  });
});
