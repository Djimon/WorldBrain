// @vitest-environment jsdom
// M17-S02: Header-Identitätsleiste (Beyond Worlds + modus-gebundenes Label)
// See: https://github.com/Djimon/WorldBrain/issues/383

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M17-S02 Header identity bar source guards', () => {
  it('WorkspaceShell header renders platform brand (Beyond Worlds)', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(source).toMatch(/brand\.platform|Beyond Worlds/);
  });

  it('header renders mode label based on useAppMode().mode', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(source).toMatch(/brand\.mode\.edit|brand\.mode\.play|RealmForge|Adventure Nexus/);
    expect(source).toMatch(/useAppMode|mode/);
  });

  it('mode label source is mode, NOT sessionRole', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    const brandSection = source.match(/brand\.mode\.(edit|play)|RealmForge|Adventure Nexus/g);
    expect(brandSection).toBeTruthy();
    const nearbyCode = source.slice(
      Math.max(0, source.indexOf(brandSection![0]) - 200),
      source.indexOf(brandSection![0]) + 200,
    );
    expect(nearbyCode).not.toMatch(/sessionRole.*brand\.mode|brand\.mode.*sessionRole/s);
  });

  it('uses primitives (Panel/StatusChip) for brand chrome, not raw divs', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(source).toMatch(/import.*(?:Panel|StatusChip).*from.*primitives/);
  });

  it('brand strings come from useTranslation (registry keys from #381)', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(source).toMatch(/t\s*\(\s*['"]brand\./);
  });
});
