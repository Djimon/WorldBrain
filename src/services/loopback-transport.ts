// M10 R4 (#375, D26): Loopback-Transport für GM-Self-Join. Der DM verbindet
// im Play-Modus als „Als Player" gegen den eigenen laufenden Host (R2) —
// keine echte WebRTC-Verbindung, aber semantisch identisch:
// - ClientAction geht durch send() an den Host-Handler
// - Host-seitige Snapshot/Delta kommt über onMessage beim Client an
// Damit lebt die D30-Membran auch lokal: der Self-Join-Client rendert
// ausschließlich aus dem Store, nicht aus der DB.
import type { SessionTransport, TransportMessage } from './session-transport';

/**
 * Ein Paar {clientSide, hostSide} verbunden über zwei In-Memory-Buffer.
 * Der DM instanziiert beide Seiten; hostSide wird vom Host-Push-Loop
 * konsumiert (send Snapshot/Delta), clientSide vom Play-Cockpit (nimmt sie
 * entgegen + sendet ClientActions zurück).
 */
export interface LoopbackPair {
  clientSide: SessionTransport;
  hostSide: SessionTransport;
}

interface Channel {
  handler: ((msg: TransportMessage) => void) | null;
}

function makeSide(peerChannel: Channel, selfChannel: Channel): SessionTransport {
  return {
    async connect() { /* Loopback: nichts zu tun. */ },
    async close() { selfChannel.handler = null; },
    async send(msg) {
      // Fire-and-forget an die andere Seite. Bewusst asynchron via microtask,
      // damit send/onMessage nicht synchron re-entrieren.
      const target = peerChannel.handler;
      if (target !== null) queueMicrotask(() => target(msg));
    },
    onMessage(cb) { selfChannel.handler = cb; },
  };
}

export function createLoopbackTransport(): LoopbackPair {
  const clientChannel: Channel = { handler: null };
  const hostChannel: Channel = { handler: null };
  return {
    // clientSide.send → hostChannel.handler; clientSide.onMessage horcht auf clientChannel
    clientSide: makeSide(hostChannel, clientChannel),
    hostSide: makeSide(clientChannel, hostChannel),
  };
}
