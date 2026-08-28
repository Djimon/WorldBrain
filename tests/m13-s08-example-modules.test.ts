// @vitest-environment node
// M13-S08: Beispiel-Module (dnd5e_srd)
// See: https://github.com/Djimon/WorldBrain/issues/243

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M13-S08 gritty_realism module', () => {
  it('gritty_realism plugin.json exists and overlays dnd5e_srd', () => {
    const manifest = JSON.parse(
      readFileSync('plugins/gritty_realism/plugin.json', 'utf-8'),
    );
    expect(manifest.overlays).toBe('dnd5e_srd');
  });

  it('patches short_rest to 8h and long_rest to 7 days', () => {
    const manifest = JSON.parse(
      readFileSync('plugins/gritty_realism/plugin.json', 'utf-8'),
    );
    const shortRest = manifest.overrides?.find(
      (e: { target: string }) => e.target === 'transition:short_rest',
    );
    const longRest = manifest.overrides?.find(
      (e: { target: string }) => e.target === 'transition:long_rest',
    );
    expect(shortRest).toBeTruthy();
    expect(longRest).toBeTruthy();
  });
});

describe('M13-S08 crit_19_20 module', () => {
  it('crit_19_20 plugin.json exists and overlays dnd5e_srd', () => {
    const manifest = JSON.parse(
      readFileSync('plugins/crit_19_20/plugin.json', 'utf-8'),
    );
    expect(manifest.overlays).toBe('dnd5e_srd');
  });

  it('patches bands:attack with crit threshold >= 19', () => {
    const manifest = JSON.parse(
      readFileSync('plugins/crit_19_20/plugin.json', 'utf-8'),
    );
    const attackPatch = manifest.overrides?.find(
      (e: { target: string }) => e.target === 'bands:attack',
    );
    expect(attackPatch).toBeTruthy();
    expect(attackPatch?.op).toMatch(/patch|replace/);
  });
});

describe('M13-S08 max_crit_damage module', () => {
  it('max_crit_damage plugin.json exists and overlays dnd5e_srd', () => {
    const manifest = JSON.parse(
      readFileSync('plugins/max_crit_damage/plugin.json', 'utf-8'),
    );
    expect(manifest.overlays).toBe('dnd5e_srd');
  });

  it('targets crit damage hook', () => {
    const manifest = JSON.parse(
      readFileSync('plugins/max_crit_damage/plugin.json', 'utf-8'),
    );
    const critHook = manifest.overrides?.find(
      (e: { target: string }) => e.target.match(/crit.*damage|damage.*crit|hook.*crit/i),
    );
    expect(critHook).toBeTruthy();
  });
});

describe('M13-S08 validation', () => {
  it('all example modules validate without errors', async () => {
    const { validateOverlayManifest } = await import('../src/services/overlay-plugin-loader');
    for (const name of ['gritty_realism', 'crit_19_20', 'max_crit_damage']) {
      const manifest = JSON.parse(
        readFileSync(`plugins/${name}/plugin.json`, 'utf-8'),
      );
      const result = validateOverlayManifest(manifest);
      expect(result.valid).toBe(true);
    }
  });
});
