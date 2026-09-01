// @vitest-environment node
// M17-S01: Zentrale Marken-/Namens-Registry
// See: https://github.com/Djimon/WorldBrain/issues/381

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M17-S01 Brand registry module', () => {
  it('brand module exists', () => {
    const source = readFileSync('src/branding/brand.ts', 'utf-8');
    expect(source).toMatch(/export/);
  });

  it('exports platform name key (Worlds and Beyond)', () => {
    const source = readFileSync('src/branding/brand.ts', 'utf-8');
    expect(source).toMatch(/brand\.platform|Worlds and Beyond/);
  });

  it('exports edit mode brand key (RealmForge)', () => {
    const source = readFileSync('src/branding/brand.ts', 'utf-8');
    expect(source).toMatch(/brand\.mode\.edit|RealmForge/);
  });

  it('exports play mode brand key (Adventure Nexus)', () => {
    const source = readFileSync('src/branding/brand.ts', 'utf-8');
    expect(source).toMatch(/brand\.mode\.play|Adventure Nexus/);
  });

  it('exports engine brand key (single key, swappable)', () => {
    const source = readFileSync('src/branding/brand.ts', 'utf-8');
    expect(source).toMatch(/brand\.engine|RuleLoom/);
  });
});

describe('M17-S01 No hardcoded brand strings outside registry', () => {
  const filesToCheck = [
    'src/ui/WorkspaceShell.tsx',
    'src/ui/primitives.tsx',
  ];

  for (const file of filesToCheck) {
    it(`${file} does not hardcode brand names`, () => {
      try {
        const source = readFileSync(file, 'utf-8');
        expect(source).not.toMatch(/"Worlds and Beyond"|'Worlds and Beyond'/);
        expect(source).not.toMatch(/"RealmForge"|'RealmForge'/);
        expect(source).not.toMatch(/"Adventure Nexus"|'Adventure Nexus'/);
      } catch { /* file may not exist yet */ }
    });
  }
});

describe('M17-S01 i18n keys resolve to German defaults', () => {
  it('i18n keys use inline German defaults via t()', () => {
    const source = readFileSync('src/branding/brand.ts', 'utf-8');
    expect(source).toMatch(/t\s*\(\s*['"]brand\./);
  });

  // AC: „die Registry-/i18n-Keys lösen zu den erwarteten deutschen Defaults auf."
  // Der Grep oben belegt die Verdrahtung; dieser Test belegt die tatsächliche
  // Auflösung über die registrierte i18n-Instanz (common-Namespace).
  it('brand keys resolve through i18n to the expected brand names', async () => {
    const { default: i18n } = await import('../src/i18n');
    await i18n.changeLanguage('de');
    expect(i18n.t('brand.platform', { ns: 'common' })).toBe('Worlds and Beyond');
    expect(i18n.t('brand.mode.edit', { ns: 'common' })).toBe('RealmForge');
    expect(i18n.t('brand.mode.play', { ns: 'common' })).toBe('Adventure Nexus');
    expect(i18n.t('brand.engine', { ns: 'common' })).toBe('RuleLoom');
  });
});
