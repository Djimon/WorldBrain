// PeerJS + public PeerServer cloud. Connection race: whoever goes `open` first
// tries `connect(otherId)` — but the broker doesn't know otherId yet →
// `peer-unavailable` (docs: transient, "try again later"). Fix: filter on
// PeerErrorType.PeerUnavailable, retry with 500ms backoff up to the global
// bench timeout. Only real network errors kill the attempt.
//
// Convention: peerLabel A|B maps to `${roomId}-a` / `${roomId}-b` as
// deterministic broker IDs.
import { Peer, PeerError } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { AdapterFactory, AdapterHandle } from '../types';

const RETRY_DELAY_MS = 500;
const TRANSIENT_ERRORS = new Set(['peer-unavailable', 'unavailable-id']);

export const peerjsAdapter: AdapterFactory = async (opts) => {
  return new Promise<AdapterHandle>((resolve, reject) => {
    const selfSide = opts.peerLabel === 'A' ? 'a' : 'b';
    const otherSide = selfSide === 'a' ? 'b' : 'a';
    const selfId = `${opts.roomId}-${selfSide}`;
    const otherId = `${opts.roomId}-${otherSide}`;
    opts.onDiagnostic?.(`[peerjs] === CONNECTION STRING ===`);
    opts.onDiagnostic?.(`[peerjs]   broker     = 0.peerjs.com:443 (default PeerServer-Cloud)`);
    opts.onDiagnostic?.(`[peerjs]   appId      = "${opts.appId}" (INFO ONLY — PeerJS-Cloud kennt keinen appId-Namespace)`);
    opts.onDiagnostic?.(`[peerjs]   roomId     = "${opts.roomId}"`);
    opts.onDiagnostic?.(`[peerjs]   self peer  = "${selfId}"   <- so registriere ich mich am Broker`);
    opts.onDiagnostic?.(`[peerjs]   target peer= "${otherId}"  <- diesen versuche ich zu connecten`);
    opts.onDiagnostic?.(`[peerjs] new Peer("${selfId}") — awaiting broker 'open' event…`);
    const peer = new Peer(selfId, undefined);
    const conns: DataConnection[] = [];
    let opened = false;
    let closed = false;
    let retryTimer: number | null = null;

    function wire(conn: DataConnection) {
      conn.on('open', () => {
        if (!opened) { opened = true; opts.onOpen(); }
      });
      conn.on('data', (data) => opts.onMessage(conn.peer, data));
      conn.on('error', (err) => {
        // Pre-open conn errors are retry noise (negotiation failed,
        // peer unreachable) — the peer.on('error') loop already retries.
        // Only POST-open errors (dropped connection) are real errors.
        if (!opened) return;
        opts.onError(err);
      });
      conn.on('close', () => { /* the bench closes actively */ });
    }

    function tryConnect() {
      if (closed || opened) return;
      opts.onDiagnostic?.(`[peerjs] peer.connect("${otherId}") — outbound attempt`);
      try {
        const c = peer.connect(otherId);
        wire(c);
        conns.push(c);
      } catch (e) {
        opts.onError(e instanceof Error ? e : new Error(String(e)));
      }
    }

    peer.on('open', (id: string) => {
      opts.onDiagnostic?.(`[peerjs] ✓ broker 'open' — registered as "${id}" (my Peer-ID at PeerServer-Cloud)`);
      tryConnect();
      resolve({
        send(payload) { for (const c of conns) if (c.open) c.send(payload); },
        async close() {
          closed = true;
          if (retryTimer !== null) window.clearTimeout(retryTimer);
          peer.destroy();
        },
      });
    });
    peer.on('connection', (c) => {
      opts.onDiagnostic?.(`[peerjs] inbound connection from ${c.peer}`);
      wire(c);
      conns.push(c);
    });
    peer.on('disconnected', () => opts.onDiagnostic?.('[peerjs] broker disconnected'));
    peer.on('error', (err: PeerError<string>) => {
      if (TRANSIENT_ERRORS.has(err.type)) {
        opts.onDiagnostic?.(`[peerjs] transient error: ${err.type} — retry in ${RETRY_DELAY_MS}ms`);
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(tryConnect, RETRY_DELAY_MS);
        return;
      }
      opts.onDiagnostic?.(`[peerjs] FATAL error: ${err.type} — ${err.message}`);
      opts.onError(err);
      if (!opened) reject(err);
    });
  });
};
