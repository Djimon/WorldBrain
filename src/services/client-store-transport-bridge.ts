// M10-#386 (D29): client-store ← transport bridge. Connects the DB-less
// play-client-store with the incoming transport feed: snapshot messages
// reset the store, delta messages (incl. token movements from
// broadcastMovement) are woven in. The only place where the client
// translates the transport feed into store state — the client never reads DB.
import type { SessionTransport, TransportMessage } from './session-transport';
import type { PlayClientStore } from './play-client-store';
import type { Delta, Snapshot } from './play-sync-protocol';

/**
 * Registers the transport's onMessage handler so that snapshot/delta
 * messages flow into the store. The TransportMessage's `type` decides:
 * - 'snapshot' → applySnapshot(payload)
 * - 'delta'    → applyDelta(payload)   (incl. token movements)
 * Other message types (e.g. 'visibility_change') are ignored here.
 */
export function attachClientStoreToTransport(
  transport: Pick<SessionTransport, 'onMessage'>,
  store: PlayClientStore,
): () => void {
  // #387: return a disposer — the transport is now multi-listener, without
  // unsubscribing an effect re-run would accumulate a second store handler.
  return transport.onMessage((msg: TransportMessage) => {
    if (msg.type === 'snapshot') {
      store.applySnapshot(msg.payload as unknown as Snapshot);
    } else if (msg.type === 'delta') {
      store.applyDelta(msg.payload as unknown as Delta);
    }
  });
}
