// M10 R4 (#375, D26): loopback transport for GM self-join. The DM connects
// in play mode as "As player" against their own running host (R2) —
// no real WebRTC connection, but semantically identical:
// - ClientAction goes through send() to the host handler
// - host-side snapshot/delta arrives at the client via onMessage
// This keeps the D30 membrane alive locally too: the self-join client renders
// exclusively from the store, not from the DB.
import type { SessionTransport, TransportMessage } from './session-transport';

/**
 * A pair {clientSide, hostSide} connected via two in-memory buffers.
 * The DM instantiates both sides; hostSide is consumed by the host-push loop
 * (send snapshot/delta), clientSide by the play cockpit (receives them
 * + sends ClientActions back).
 */
export interface LoopbackPair {
  clientSide: SessionTransport;
  hostSide: SessionTransport;
}

// M10-#387: faithfully models the real WebRtcTransport semantics — MULTIPLE
// onMessage listeners (every message to all) + bounded receive-replay buffer
// (late subscribers get already-arrived messages replayed).
// A single handler would have masked the host-handler conflict (token-sync/join-sync)
// in the test, the way the original loopback did.
interface Channel {
  handlers: Array<(msg: TransportMessage) => void>;
  inbox: TransportMessage[];
}

const MAX_INBOX = 64;

function makeSide(peerChannel: Channel, selfChannel: Channel): SessionTransport {
  return {
    async connect() { /* Loopback: nothing to do. */ },
    async close() { selfChannel.handlers = []; selfChannel.inbox = []; },
    async send(msg) {
      // Fire-and-forget to the other side. Deliberately asynchronous via microtask,
      // so that send/onMessage do not re-enter synchronously.
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
    // clientSide.send → hostChannel; clientSide.onMessage listens on clientChannel
    clientSide: makeSide(hostChannel, clientChannel),
    hostSide: makeSide(clientChannel, hostChannel),
  };
}
