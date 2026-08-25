// @vitest-environment node
// M13-S06: Konflikt-Erkennung & Validierungs-UX
// See: https://github.com/Djimon/WorldBrain/issues/241

import { describe, expect, it } from 'vitest';

describe('M13-S06 Conflict detection service', () => {
  async function getService() {
    return import('../src/services/overlay-conflict-service');
  }

  it('detects conflict when two modules target the same ID', async () => {
    const svc = await getService();
    const result = svc.detectConflicts([
      { id: 'mod_a', overrides: [{ target: 'bands:attack', op: 'patch' as const, value: { crit: 19 } }] },
      { id: 'mod_b', overrides: [{ target: 'bands:attack', op: 'replace' as const, value: { crit: 20 } }] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('bands:attack');
    expect(result[0].winner).toBe('mod_b');
    expect(result[0].loser).toBe('mod_a');
  });

  it('no conflict when modules target different IDs', async () => {
    const svc = await getService();
    const result = svc.detectConflicts([
      { id: 'mod_a', overrides: [{ target: 'bands:attack', op: 'patch' as const, value: {} }] },
      { id: 'mod_b', overrides: [{ target: 'transition:long_rest', op: 'replace' as const, value: {} }] },
    ]);
    expect(result).toHaveLength(0);
  });

  it('reports error when module targets non-existent base ID', async () => {
    const svc = await getService();
    const errors = svc.validateModuleTargets(
      { id: 'broken', overlays: 'dnd5e_srd', overrides: [{ target: 'nonexistent:foo', op: 'patch' as const, value: {} }] },
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/nonexistent:foo/);
  });

  it('lists targeted IDs and operations for a module (diff preview)', async () => {
    const svc = await getService();
    const diff = svc.moduleDiff({
      id: 'gritty_realism',
      overrides: [
        { target: 'transition:short_rest', op: 'patch' as const, value: { duration: '8h' } },
        { target: 'transition:long_rest', op: 'replace' as const, value: { duration: '7d' } },
      ],
    });
    expect(diff).toHaveLength(2);
    expect(diff[0]).toMatchObject({ target: 'transition:short_rest', op: 'patch' });
    expect(diff[1]).toMatchObject({ target: 'transition:long_rest', op: 'replace' });
  });
});
