// @vitest-environment jsdom
// M10-S23: Read-only Player-Gating — Edit-Affordances app-weit ausblenden (D25)
// See: https://github.com/Djimon/WorldBrain/issues/346

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source guards — S23 blocked by S22, so source-level checks only
// ---------------------------------------------------------------------------

describe('M10-S23 Source guards', () => {
  it('useReadOnly hook exists and is exported', () => {
    const source = readFileSync('src/ui/useReadOnly.ts', 'utf-8');
    expect(source).toMatch(/export.*useReadOnly/);
  });

  it('useReadOnly derives readOnly from mode=play + sessionRole=player', () => {
    const source = readFileSync('src/ui/useReadOnly.ts', 'utf-8');
    expect(source).toMatch(/play/);
    expect(source).toMatch(/player/);
  });

  it('useReadOnly reads from AppModeContext (not prop drilling)', () => {
    const source = readFileSync('src/ui/useReadOnly.ts', 'utf-8');
    expect(source).toMatch(/AppModeContext|useAppMode/);
  });

  it('EntityMasterDetail checks readOnly before rendering create/edit/delete', () => {
    const source = readFileSync('src/ui/EntityMasterDetail.tsx', 'utf-8');
    expect(source).toMatch(/readOnly|useReadOnly/);
  });

  it('CalendarMonthView checks readOnly before rendering event creation', () => {
    const source = readFileSync('src/ui/CalendarMonthView.tsx', 'utf-8');
    expect(source).toMatch(/readOnly|useReadOnly/);
  });

  it('MapViewer checks readOnly before rendering marker/token edit', () => {
    const source = readFileSync('src/ui/MapViewer.tsx', 'utf-8');
    expect(source).toMatch(/readOnly|useReadOnly/);
  });
});
