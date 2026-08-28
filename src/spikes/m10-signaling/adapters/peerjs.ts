// PeerJS + Public PeerServer-Cloud. Verbindungs-Race: wer zuerst `open` wird,
// versucht `connect(otherId)` — der Broker kennt otherId aber noch nicht →
// `peer-unavailable` (Doku: transient, „try again later"). Fix: filter auf
// PeerErrorType.PeerUnavailable, Retry mit 500ms Backoff bis zum globalen
// bench-Timeout. Nur echte Netzwerk-Fehler killen den Attempt.
//
// Konvention: peerLabel A|B mappt auf `${roomId}-a` / `${roomId}-b` als
// deterministische Broker-IDs.
import { Peer, PeerError } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { AdapterFactory, AdapterHandle } from '../types';

const RETRY_DELAY_MS = 500;
const TRANSIENT_ERRORS = new Set(['peer-unavailable', 'unavailable-id']);

export const peerjsAdapter: AdapterFactory = async (opts) => {
  return new Promise<AdapterHandle>((resolve, reject) => {
    const selfSide = opts.peerLabel === 'A' ? 'a' : 'b';
    const otherSide = selfSide === 'a' ? 'b' : 'a';
    const otherId = `${opts.roomId}-${otherSide}`;
    const peer = new Peer(`${opts.roomId}-${selfSide}`, undefined);
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
        // Pre-open conn-Errors sind Retry-Rauschen (negotiation gescheitert,
        // Peer nicht erreichbar) — der peer.on('error')-Loop retry'd bereits.
        // Nur POST-open-Fehler (gerissene Verbindung) sind echte Fehler.
        if (!opened) return;
        opts.onError(err);
      });
      conn.on('close', () => { /* bench schließt aktiv */ });
    }

    function tryConnect() {
      if (closed || opened) return;
      try {
        const c = peer.connect(otherId);
        wire(c);
        conns.push(c);
      } catch (e) {
        // Sync-throw ist selten bei PeerJS — meist kommt der Fehler via 'error'.
        opts.onError(e instanceof Error ? e : new Error(String(e)));
      }
    }

    peer.on('open', () => {
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
    peer.on('connection', (c) => { wire(c); conns.push(c); });
    peer.on('error', (err: PeerError<string>) => {
      if (TRANSIENT_ERRORS.has(err.type)) {
        // Transient — Retry planen. Der bench-Timeout (10s) begrenzt die Loop.
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(tryConnect, RETRY_DELAY_MS);
        return;
      }
      opts.onError(err);
      if (!opened) reject(err);
    });
  });
};
