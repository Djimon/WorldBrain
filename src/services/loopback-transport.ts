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

// M10-#387: modelliert die echte WebRtcTransport-Semantik treu — MEHRERE
// onMessage-Listener (jede Nachricht an alle) + bounded Receive-Replay-Puffer
// (späte Subscriber bekommen bereits eingetroffene Nachrichten nachgespielt).
// Single-Handler hätte den Host-Handler-Konflikt (token-sync/join-sync) im Test
// verdeckt, so wie es der ursprüngliche Loopback tat.
interface Channel {
  handlers: Array<(msg: TransportMessage) => void>;
  inbox: TransportMessage[];
}

const MAX_INBOX = 64;

function makeSide(peerChannel: Channel, selfChannel: Channel): SessionTransport {
  return {
    async connect() { /* Loopback: nichts zu tun. */ },
    async close() { selfChannel.handlers = []; selfChannel.inbox = []; },
    async send(msg) {
      // Fire-and-forget an die andere Seite. Bewusst asynchron via microtask,
      // damit send/onMessage nicht synchron re-entrieren.
      queueMicrotask(() => {
        if (peerChannel.inbox.length >= MAX_INBOX) peerChannel.inbox.shift();
        peerChannel.inbox.push(msg);
        for (const h of [...peerChannel.handlers]) h(msg);
      });
    },
    onMessage(cb) {
      selfChannel.handlers.push(cb);
      for (const m of selfChannel.inbox) cb(m);
      return () => {
        const i = selfChannel.handlers.indexOf(cb);
        if (i !== -1) selfChannel.handlers.splice(i, 1);
      };
    },
  };
}

export function createLoopbackTransport(): LoopbackPair {
  const clientChannel: Channel = { handlers: [], inbox: [] };
  const hostChannel: Channel = { handlers: [], inbox: [] };
  return {
    // clientSide.send → hostChannel; clientSide.onMessage horcht auf clientChannel
    clientSide: makeSide(hostChannel, clientChannel),
    hostSide: makeSide(clientChannel, hostChannel),
  };
}
