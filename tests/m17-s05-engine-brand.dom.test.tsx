// @vitest-environment jsdom
// M17-S05: Engine-Marke an USP-Flächen (Plugin-Manager, Onboarding)
// See: https://github.com/Djimon/WorldBrain/issues/384

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M17-S05 Engine brand source guards', () => {
  it('PluginManager shows engine brand via registry key', () => {
    const source = readFileSync('src/ui/PluginManager.tsx', 'utf-8');
    expect(source).toMatch(/brand\.engine|RuleLoom/);
  });

  it('engine brand uses useTranslation, not hardcoded string', () => {
    const source = readFileSync('src/ui/PluginManager.tsx', 'utf-8');
    expect(source).toMatch(/t\s*\(\s*['"]brand\.engine/);
  });

  it('engine brand is NOT in the mode toggle', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    const modeToggleArea = source.match(/Segmented[\s\S]*?modeToggle/i);
    if (modeToggleArea) {
      expect(modeToggleArea[0]).not.toMatch(/brand\.engine|RuleLoom/);
    }
  });

  it('engine brand uses primitives, not raw HTML', () => {
    const source = readFileSync('src/ui/PluginManager.tsx', 'utf-8');
    expect(source).toMatch(/import.*from.*primitives/);
  });
});
