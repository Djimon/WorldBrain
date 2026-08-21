// @vitest-environment node
// M10 (rebuild): Token-Bewegung im Multiplayer (Default offen, D18)
// See: https://github.com/Djimon/WorldBrain/issues/366

import { describe, expect, it } from 'vitest';

describe('M10-Token movement service', () => {
  async function getTokenMovementService() {
    return import('../src/services/token-movement-service');
  }

  it('moveToken accepts position and player context', async () => {
    const svc = await getTokenMovementService();
    expect(svc).toHaveProperty('moveToken');
  });

  it('any active player can move any token (default open)', async () => {
    const svc = await getTokenMovementService();
    const result = await svc.moveToken({
      tokenId: 'tok-1',
      playerId: 'p-1',
      playerStatus: 'active',
      x: 100,
      y: 200,
    });
    expect(result.success).toBe(true);
  });

  it('kicked player cannot move tokens', async () => {
    const svc = await getTokenMovementService();
    const result = await svc.moveToken({
      tokenId: 'tok-1',
      playerId: 'p-kicked',
      playerStatus: 'kicked',
      x: 100,
      y: 200,
    });
    expect(result.success).toBe(false);
  });

  it('movement is purely visual (no grid/range enforcement)', async () => {
    const svc = await getTokenMovementService();
    const result = await svc.moveToken({
      tokenId: 'tok-1',
      playerId: 'p-1',
      playerStatus: 'active',
      x: 99999,
      y: 99999,
    });
    expect(result.success).toBe(true);
  });

  it('broadcastMovement function exists for live push', async () => {
    const svc = await getTokenMovementService();
    expect(svc).toHaveProperty('broadcastMovement');
  });
});
