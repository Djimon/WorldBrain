// @vitest-environment node
// M16-S10: Vorberechnete + gecachte Layout-Positionen
// See: https://github.com/Djimon/WorldBrain/issues/327

import { describe, expect, it } from 'vitest';

describe('M16-S10 computeLayout', () => {
  async function getService() {
    return import('../src/services/graph-layout-service');
  }

  it('computeLayout returns positions for all nodes', async () => {
    const svc = await getService();
    const model = {
      nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
      edges: [{ source: 'n1', target: 'n2' }],
    };
    const positions = await svc.computeLayout(model, { seed: 42 });
    expect(positions.size).toBe(3);
    for (const [, pos] of positions) {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });

  it('deterministic: same input + seed → same positions', async () => {
    const svc = await getService();
    const model = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b' }],
    };
    const pos1 = await svc.computeLayout(model, { seed: 42 });
    const pos2 = await svc.computeLayout(model, { seed: 42 });
    expect(pos1.get('a')!.x).toBe(pos2.get('a')!.x);
    expect(pos1.get('a')!.y).toBe(pos2.get('a')!.y);
    expect(pos1.get('b')!.x).toBe(pos2.get('b')!.x);
  });

  it('2D mode: positions have no z', async () => {
    const svc = await getService();
    const model = {
      nodes: [{ id: 'n1' }],
      edges: [],
    };
    const positions = await svc.computeLayout(model, { seed: 1 });
    const pos = positions.get('n1')!;
    expect(pos).not.toHaveProperty('z');
  });
});

describe('M16-S10 structure hash cache', () => {
  async function getService() {
    return import('../src/services/graph-layout-service');
  }

  it('structureHash exists', async () => {
    const svc = await getService();
    expect(svc).toHaveProperty('structureHash');
  });

  it('same graph → same hash', async () => {
    const svc = await getService();
    const model = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b' }],
    };
    expect(svc.structureHash(model)).toBe(svc.structureHash(model));
  });

  it('adding a node changes the hash', async () => {
    const svc = await getService();
    const m1 = { nodes: [{ id: 'a' }], edges: [] };
    const m2 = { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] };
    expect(svc.structureHash(m1)).not.toBe(svc.structureHash(m2));
  });
});
