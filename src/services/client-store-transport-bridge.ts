// M10-#386 (D29): Client-Store ← Transport-Bridge. Verbindet den DB-losen
// play-client-store mit dem eingehenden Transport-Feed: Snapshot-Nachrichten
// setzen den Store neu, Delta-Nachrichten (inkl. Token-Bewegungen aus
// broadcastMovement) werden eingewoben. Die einzige Stelle, an der der Client
// den Transport-Feed in Store-State übersetzt — der Client liest nie DB.
import type { SessionTransport, TransportMessage } from './session-transport';
import type { PlayClientStore } from './play-client-store';
import type { Delta, Snapshot } from './play-sync-protocol';

/**
 * Registriert den onMessage-Handler des Transports so, dass Snapshot/Delta-
 * Nachrichten in den Store fließen. `type` der TransportMessage entscheidet:
 * - 'snapshot' → applySnapshot(payload)
 * - 'delta'    → applyDelta(payload)   (auch Token-Bewegungen)
 * Andere Nachrichtentypen (z.B. 'visibility_change') werden hier ignoriert.
 */
export function attachClientStoreToTransport(
  transport: Pick<SessionTransport, 'onMessage'>,
  store: PlayClientStore,
): () => void {
  // #387: Disposer zurückgeben — der Transport ist jetzt Multi-Listener, ohne
  // Abmelden würde ein Effekt-Re-Run einen zweiten Store-Handler akkumulieren.
  return transport.onMessage((msg: TransportMessage) => {
    if (msg.type === 'snapshot') {
      store.applySnapshot(msg.payload as unknown as Snapshot);
    } else if (msg.type === 'delta') {
      store.applyDelta(msg.payload as unknown as Delta);
    }
  });
}
