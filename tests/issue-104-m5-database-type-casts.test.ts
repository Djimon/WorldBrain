// @vitest-environment node
// Issue #104: database as never casts in M5/E8 UI components — recurring pattern from M2.

import { describe, expect, it } from 'vitest';

const fs = await import('fs');
function src(path: string) { return fs.readFileSync(path, 'utf8'); }

const components = [
  'src/ui/CalendarWizard.tsx',
  'src/ui/SessionClock.tsx',
  'src/ui/EncounterCounters.tsx',
  'src/ui/SessionGridTracker.tsx',
  'src/ui/MapViewer.tsx',
  'src/blocks/MapEmbedBlock.tsx',
  'src/ui/MapMarkers.tsx',
];

describe('issue-104 no database as never in M5/E8 components', () => {
  for (const path of components) {
    it(`${path} has no "as never" casts`, () => {
      const source = src(path);
      expect(source).not.toMatch(/database\s+as\s+never|as\s+never\s*[,)]/);
    });
  }

  it('CalendarWizard types database prop as DatabaseLike', () => {
    const source = src('src/ui/CalendarWizard.tsx');
    expect(source).toMatch(/database\s*:\s*DatabaseLike/);
  });

  it('SessionClock types database prop as DatabaseLike', () => {
    const source = src('src/ui/SessionClock.tsx');
    expect(source).toMatch(/database\s*:\s*DatabaseLike/);
  });

  it('EncounterCounters types database prop as DatabaseLike', () => {
    const source = src('src/ui/EncounterCounters.tsx');
    expect(source).toMatch(/database\s*:\s*DatabaseLike/);
  });

  it('SessionGridTracker types database prop as DatabaseLike', () => {
    const source = src('src/ui/SessionGridTracker.tsx');
    expect(source).toMatch(/database\s*:\s*DatabaseLike/);
  });

  it('entity-service.ts exports DatabaseLike (the fix source)', () => {
    const source = src('src/services/entity-service.ts');
    expect(source).toMatch(/export.*DatabaseLike|export type DatabaseLike/);
  });
});
