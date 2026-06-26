// MI-S00b: DatabaseLike interface migration — prepare() → execute()/select()
// Tests must fail (Red) until all 15 services are migrated.
// See: https://github.com/Djimon/WorldBrain/issues/192

import { readFileSync } from 'fs';
import { describe, expect, it, vi } from 'vitest';

function src(path: string) {
  return readFileSync(path, 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. DatabaseLike interface shape
// ---------------------------------------------------------------------------

describe('MI-S00b DatabaseLike interface', () => {
  it('interface declares execute(sql, args?) method', () => {
    const source = src('src/services/entity-service.ts');
    expect(source).toMatch(/execute\s*\(/);
  });

  it('interface declares select<T>(sql, args?) method', () => {
    const source = src('src/services/entity-service.ts');
    expect(source).toMatch(/select\s*[<(]/);
  });

  it('interface does not declare prepare() method', () => {
    const source = src('src/services/entity-service.ts');
    // Only match prepare inside a type/interface block, not inside function bodies
    const interfaceBlock = source.match(/type DatabaseLike\s*=\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(interfaceBlock).not.toMatch(/prepare/);
  });
});

// ---------------------------------------------------------------------------
// 2. All 15 services must not call db.prepare()
// ---------------------------------------------------------------------------

const AFFECTED_SERVICES = [
  'src/services/capture-service.ts',
  'src/services/card-service.ts',
  'src/services/dm-screen-service.ts',
  'src/services/entity-service.ts',
  'src/services/event-service.ts',
  'src/services/handout-service.ts',
  'src/services/map-marker-service.ts',
  'src/services/map-service.ts',
  'src/services/relation-service.ts',
  'src/services/rule-import-service.ts',
  'src/services/saved-views-service.ts',
  'src/services/search-service.ts',
  'src/services/session-grid-service.ts',
  'src/services/session-undo-service.ts',
  'src/services/session-variable-service.ts',
];

describe('MI-S00b no prepare() calls in services', () => {
  for (const file of AFFECTED_SERVICES) {
    it(`${file.replace('src/services/', '')} does not call .prepare(`, () => {
      const source = src(file);
      expect(source).not.toMatch(/\.prepare\s*\(/);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Behavioral: services work with async execute()/select() mock
// ---------------------------------------------------------------------------

const mockExecute = vi.fn().mockResolvedValue(undefined);
const mockSelect = vi.fn().mockResolvedValue([]);

const asyncDb = {
  execute: mockExecute,
  select: mockSelect,
};

describe('MI-S00b entity-service uses async execute()/select()', () => {
  it('listEntitiesByType returns a Promise when called with async db', async () => {
    vi.resetModules();
    const { listEntitiesByType } = await import('../src/services/entity-service');
    mockSelect.mockResolvedValue([]);
    const result = listEntitiesByType({ database: asyncDb as never, type: 'character' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('listEntitiesByType calls db.select() not db.prepare()', async () => {
    vi.resetModules();
    mockExecute.mockClear();
    mockSelect.mockClear();
    mockSelect.mockResolvedValue([]);
    const { listEntitiesByType } = await import('../src/services/entity-service');
    await listEntitiesByType({ database: asyncDb as never, type: 'character' });
    expect(mockSelect).toHaveBeenCalled();
  });

  it('updateEntityProperties returns a Promise when called with async db', async () => {
    vi.resetModules();
    mockExecute.mockClear();
    mockExecute.mockResolvedValue(undefined);
    const { updateEntityProperties } = await import('../src/services/entity-service');
    const result = updateEntityProperties({ database: asyncDb as never, entityId: 'e1', properties: {} });
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('MI-S00b search-service uses async execute()/select()', () => {
  it('rebuildSearchIndex returns a Promise when called with async db', async () => {
    vi.resetModules();
    mockExecute.mockClear();
    mockSelect.mockClear();
    mockExecute.mockResolvedValue(undefined);
    mockSelect.mockResolvedValue([]);
    const { rebuildSearchIndex } = await import('../src/services/search-service');
    const result = rebuildSearchIndex(asyncDb as never);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('MI-S00b saved-views-service uses async execute()/select()', () => {
  it('listSavedViews returns a Promise when called with async db', async () => {
    vi.resetModules();
    mockSelect.mockClear();
    mockSelect.mockResolvedValue([]);
    const { listSavedViews } = await import('../src/services/saved-views-service');
    const result = listSavedViews(asyncDb as never);
    expect(result).toBeInstanceOf(Promise);
  });
});
