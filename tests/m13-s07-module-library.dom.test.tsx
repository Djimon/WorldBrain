// @vitest-environment jsdom
// M13-S07: UI — Modul-Bibliothek & per-Session-Toggle
// See: https://github.com/Djimon/WorldBrain/issues/242

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M13-S07 ModuleLibrary source guards', () => {
  it('ModuleLibrary component exists', () => {
    const source = readFileSync('src/ui/ModuleLibrary.tsx', 'utf-8');
    expect(source).toMatch(/export.*ModuleLibrary/);
  });

  it('uses primitives (ListSurface or Panel), not raw HTML containers', () => {
    const source = readFileSync('src/ui/ModuleLibrary.tsx', 'utf-8');
    expect(source).toMatch(/import.*(?:ListSurface|Panel|Tabs).*from.*primitives/);
  });

  it('uses useTranslation, no hardcoded strings', () => {
    const source = readFileSync('src/ui/ModuleLibrary.tsx', 'utf-8');
    expect(source).toMatch(/useTranslation/);
    expect(source).not.toMatch(/>Modul|>Module|>Bibliothek|>Library</);
  });

  it('accepts database prop typed as DatabaseLike', () => {
    const source = readFileSync('src/ui/ModuleLibrary.tsx', 'utf-8');
    expect(source).toMatch(/database.*DatabaseLike|DatabaseLike/);
  });

  it('renders per-session toggle list', () => {
    const source = readFileSync('src/ui/ModuleLibrary.tsx', 'utf-8');
    expect(source).toMatch(/toggle|activate|deactivate|enabled/i);
  });

  it('shows diff preview (uses conflict service or moduleDiff)', () => {
    const source = readFileSync('src/ui/ModuleLibrary.tsx', 'utf-8');
    expect(source).toMatch(/diff|moduleDiff|overlay-conflict|detectConflicts/i);
  });

  it('no prompt/alert/confirm calls', () => {
    const source = readFileSync('src/ui/ModuleLibrary.tsx', 'utf-8');
    expect(source).not.toMatch(/\bprompt\s*\(|alert\s*\(|confirm\s*\(/);
  });
});
