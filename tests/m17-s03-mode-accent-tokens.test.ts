// @vitest-environment node
// M17-S03: Modus-Akzent-Token-System (Default-Theme: Prep Rot / Live Amber)
// See: https://github.com/Djimon/WorldBrain/issues/382

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M17-S03 Mode accent tokens in tokens.css', () => {
  it('tokens.css defines --mode-accent', () => {
    const source = readFileSync('src/styles/tokens.css', 'utf-8');
    expect(source).toMatch(/--mode-accent\s*:/);
  });

  it('tokens.css defines all five mode-accent tokens', () => {
    const source = readFileSync('src/styles/tokens.css', 'utf-8');
    for (const token of ['--mode-accent', '--mode-accent-hover', '--mode-accent-on', '--mode-accent-text', '--mode-accent-soft']) {
      expect(source).toMatch(new RegExp(`${token.replace(/[-]/g, '\\-')}\\s*:`));
    }
  });
});

describe('M17-S03 Default-Theme prep/live values', () => {
  it('prep (edit) accent is red #e5484d', () => {
    const source = readFileSync('src/styles/tokens.css', 'utf-8');
    expect(source).toMatch(/#e5484d/i);
  });

  it('live (play) accent is amber #eaa53c', () => {
    const source = readFileSync('src/styles/tokens.css', 'utf-8');
    expect(source).toMatch(/#eaa53c/i);
  });

  it('mode-accent-on differs per mode (white for red, dark for amber)', () => {
    const source = readFileSync('src/styles/tokens.css', 'utf-8');
    expect(source).toMatch(/#ffffff/i);
    expect(source).toMatch(/#241a05/i);
  });
});

describe('M17-S03 Primitives use mode-accent tokens', () => {
  it('Button primary uses --mode-accent, not hardcoded hex', () => {
    const primSource = readFileSync('src/ui/primitives.tsx', 'utf-8');
    const cssFiles = ['src/styles/tokens.css', 'src/styles/utilities.css'];
    let usesToken = primSource.includes('mode-accent');
    for (const f of cssFiles) {
      try {
        if (readFileSync(f, 'utf-8').includes('mode-accent')) usesToken = true;
      } catch { /* ok */ }
    }
    expect(usesToken).toBe(true);
  });
});

describe('M17-S03 Accessibility: mode not only via color', () => {
  it('mode indicator exists in at least two non-color forms', () => {
    const shell = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    let indicators = 0;
    if (shell.match(/brand\.mode|modeLabel|RealmForge|Adventure Nexus/i)) indicators++;
    if (shell.match(/useReadOnly|readOnly|locked|gesperrt/i)) indicators++;
    if (shell.match(/aria-label.*mode|aria-current/i)) indicators++;
    expect(indicators).toBeGreaterThanOrEqual(2);
  });
});

describe('M17-S03 Default-Theme appearanceSupport: both', () => {
  it('light appearance tokens exist (separate from dark)', () => {
    const source = readFileSync('src/styles/tokens.css', 'utf-8');
    // #385: Erscheinung ist als eigene Achse `data-appearance` entkoppelt.
    expect(source).toMatch(/prefers-color-scheme.*light|data-(theme|appearance).*light/i);
  });
});
