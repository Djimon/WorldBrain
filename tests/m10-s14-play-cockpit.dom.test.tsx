// @vitest-environment jsdom
// M10-S14 (rebuild): Play-Cockpit — Reiter Map/Kampflog/Spotlight + Free-Browse
// See: https://github.com/Djimon/WorldBrain/issues/360

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M10-S14 Source guards', () => {
  it('PlayModeView component exists', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).toMatch(/export.*PlayModeView/);
  });

  it('PlayModeView uses Tabs from primitives (not raw tab HTML)', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).toMatch(/import.*Tabs.*from.*primitives/);
  });

  it('PlayModeView has three tabs: Map, Kampflog, Spotlight', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).toMatch(/[Mm]ap/);
    expect(source).toMatch(/[Kk]ampflog|[Cc]ombat.?[Ll]og/);
    expect(source).toMatch(/[Ss]potlight/);
  });

  it('PlayModeView accepts role prop (dm|player)', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).toMatch(/role.*dm.*player|'dm'\s*\|\s*'player'/);
  });

  it('PlayModeView reads AppModeContext or accepts activeSessionId', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).toMatch(/activeSessionId|AppModeContext|useAppMode/);
  });

  it('PlayModeView has free-browse section', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).toMatch(/free.?browse|browse|entity|handout/i);
  });

  it('PlayModeView uses Panel from primitives', () => {
    const source = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(source).toMatch(/import.*Panel.*from.*primitives/);
  });
});
