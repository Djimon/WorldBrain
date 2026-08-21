// @vitest-environment node
// M10-S16 (rebuild): Würfel-Roller + per-Wurf-Sichtbarkeit
// See: https://github.com/Djimon/WorldBrain/issues/362

import { describe, expect, it } from 'vitest';

describe('M10-S16 Dice roller parsing', () => {
  async function getDiceService() {
    return import('../src/services/dice-roller-service');
  }

  it('parses "2d6+3" correctly', async () => {
    const svc = await getDiceService();
    const result = svc.parseDiceExpression('2d6+3');
    expect(result.count).toBe(2);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(3);
  });

  it('parses "1d20" without modifier', async () => {
    const svc = await getDiceService();
    const result = svc.parseDiceExpression('1d20');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
    expect(result.modifier).toBe(0);
  });

  it('invalid expression throws clear error', async () => {
    const svc = await getDiceService();
    expect(() => svc.parseDiceExpression('abc')).toThrow();
  });
});

describe('M10-S16 Dice rolling', () => {
  async function getDiceService() {
    return import('../src/services/dice-roller-service');
  }

  it('roll returns a result within valid range', async () => {
    const svc = await getDiceService();
    const result = await svc.roll('2d6+3');
    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(result.total).toBeLessThanOrEqual(15);
    expect(result.expression).toBe('2d6+3');
  });

  it('roll result includes individual dice values', async () => {
    const svc = await getDiceService();
    const result = await svc.roll('3d8');
    expect(result.dice).toHaveLength(3);
    result.dice.forEach((d: number) => {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(8);
    });
  });
});

describe('M10-S16 Per-roll visibility', () => {
  async function getDiceService() {
    return import('../src/services/dice-roller-service');
  }

  it('roll accepts visibility option (private|dm_only|all)', async () => {
    const svc = await getDiceService();
    const result = await svc.roll('1d20', { visibility: 'dm_only' });
    expect(result.visibility).toBe('dm_only');
  });

  it('roll result includes visibility for routing', async () => {
    const svc = await getDiceService();
    const result = await svc.roll('1d6', { visibility: 'all' });
    expect(result).toHaveProperty('visibility');
  });
});
