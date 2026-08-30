// @vitest-environment node
// M10-S18 (#366): Live-Push-Integrationstest — die Token-Bewegung eines Peers
// erscheint beim anderen über den (Loopback-)Transport, im DB-losen Client-
// Store (D29). Kein lokaler DB-Zugriff auf der Client-Seite.
import { describe, expect, it } from 'vitest';
import { createLoopbackTransport } from '../src/services/loopback-transport';
import { createPlayClientStore } from '../src/services/play-client-store';
import { broadcastMovement, applyMovementMessage, moveToken } from '../src/services/token-movement-service';

describe('M10-S18 Token live-push over transport', () => {
  it("a peer's token move appears at the other peer via the transport feed", async () => {
    const { clientSide, hostSide } = createLoopbackTransport();
    const store = createPlayClientStore({ playerId: 'p-1' });

    // Client hört auf den Transport und speist Token-Bewegungen in den Store.
    clientSide.onMessage((msg) => { applyMovementMessage(msg, store); });

    // Host autorisiert + broadcastet die Bewegung eines aktiven Spielers.
    const auth = moveToken({ tokenId: 'tok-1', playerId: 'p-2', playerStatus: 'active', x: 100, y: 200 });
    expect(auth.success).toBe(true);
    broadcastMovement({ campaignId: 'c1', tokenId: 'tok-1', x: 100, y: 200 }, hostSide);

    // Loopback pusht per Microtask — kurz warten.
    await new Promise<void>((r) => setTimeout(r, 0));

    const token = store.get('token', 'tok-1');
    expect(token).not.toBeNull();
    expect(token?.data).toEqual({ x: 100, y: 200 });
  });

  it('a follow-up move updates the same token in the client store', async () => {
    const { clientSide, hostSide } = createLoopbackTransport();
    const store = createPlayClientStore({ playerId: 'p-1' });
    clientSide.onMessage((msg) => { applyMovementMessage(msg, store); });

    broadcastMovement({ campaignId: 'c1', tokenId: 'tok-1', x: 10, y: 10 }, hostSide);
    await new Promise<void>((r) => setTimeout(r, 0));
    broadcastMovement({ campaignId: 'c1', tokenId: 'tok-1', x: 50, y: 60 }, hostSide);
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(store.get('token', 'tok-1')?.data).toEqual({ x: 50, y: 60 });
  });

  it('non-delta transport messages are ignored by applyMovementMessage', () => {
    const store = createPlayClientStore({ playerId: 'p-1' });
    const applied = applyMovementMessage(
      { type: 'visibility_change', token: 'system-dm', payload: {} },
      store,
    );
    expect(applied).toBe(false);
  });
});
