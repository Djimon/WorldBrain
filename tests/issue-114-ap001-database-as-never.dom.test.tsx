// @vitest-environment jsdom
// Cross-cutting AP-001 bug: database typed as `unknown`/`never` in M3/M4 UI components.
// Stories: M3-S03 (GlobalSearch), M3-S04 (EntityTable), M3-S05/M3-S07 (GlobalEntityGraph),
//          M4-S09 (PlayerScreen), M4-S07 (CaptureInbox).
// See: https://github.com/Djimon/WorldBrain/issues/114
//
// Each test passes a correctly-typed DatabaseLike value to the component prop without
// any `as never` / `as unknown` cast. TypeScript compile errors here = bug still present.

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/search-service', () => ({
  searchEntities: vi.fn(() => []),
  getSearchFacets: vi.fn(() => ({})),
}));
vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(() => []),
  getEffectiveEntity: vi.fn(() => null),
}));
vi.mock('../src/services/relation-service', () => ({
  listRelations: vi.fn(() => []),
  getAllRelations: vi.fn(() => []),
}));
vi.mock('../src/services/capture-service', () => ({
  listCaptures: vi.fn(() => []),
  createCapture: vi.fn(),
  updateCaptureStatus: vi.fn(),
}));
vi.mock('../src/services/visibility-service', () => ({
  resolveVisibility: vi.fn(() => 'visible'),
}));

// Minimal object satisfying DatabaseLike (exec + prepare with run/all/get)
function makeMockDb() {
  return {
    exec: vi.fn(),
    prepare: vi.fn(() => ({ run: vi.fn(), all: vi.fn(() => []), get: vi.fn(() => null) })),
  };
}

describe('issue #114: AP-001 — database prop must be typed as DatabaseLike, not unknown/never', () => {
  it('GlobalSearch accepts a DatabaseLike database prop without cast', async () => {
    const { GlobalSearch } = await import('../src/ui/GlobalSearch');
    const db = makeMockDb();
    // No `as never` cast — this is the fix verification
    expect(() => render(<GlobalSearch database={db} />)).not.toThrow();
  });

  it('EntityTable accepts a DatabaseLike database prop without cast', async () => {
    const { EntityTable } = await import('../src/ui/EntityTable');
    const db = makeMockDb();
    expect(() => render(<EntityTable database={db} entityType="Character" />)).not.toThrow();
  });

  it('GlobalEntityGraph accepts a DatabaseLike database prop without cast', async () => {
    const { GlobalEntityGraph } = await import('../src/ui/GlobalEntityGraph');
    const db = makeMockDb();
    expect(() => render(<GlobalEntityGraph database={db} />)).not.toThrow();
  });

  it('PlayerScreen accepts a DatabaseLike database prop without cast', async () => {
    const { PlayerScreen } = await import('../src/ui/PlayerScreen');
    const db = makeMockDb();
    expect(() => render(<PlayerScreen database={db} sessionId="s1" selectedEntityIds={[]} context={{ audience: 'player', vars: {}, globals: {}, flags: {}, knownEntities: new Set() }} />)).not.toThrow();
  });

  it('CaptureInbox accepts a DatabaseLike database prop without cast', async () => {
    const { CaptureInbox } = await import('../src/ui/CaptureInbox');
    const db = makeMockDb();
    // Before fix: `database: never` makes this a type error; after fix: `database: DatabaseLike`
    expect(() => render(<CaptureInbox sessionId="s1" database={db} />)).not.toThrow();
  });
});
