// M10-S12 (#368): PeerJS-Cloud — Backup-Broker (Spike 9-10/10, ~216ms).
// Kein appId-Namespace am Broker → salted Prefix muss DIREKT in die Peer-ID.
// Deshalb: `${appId}-${roomId}-${peerLabel}` als vollständige Peer-ID.
import { Peer, PeerError } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { AdapterFactory, AdapterHandle } from './types';

const RETRY_DELAY_MS = 500;
const TRANSIENT_ERRORS = new Set(['peer-unavailable', 'unavailable-id']);

export const peerjsAdapter: AdapterFactory = async (opts) => {
  return new Promise<AdapterHandle>((resolve, reject) => {
    const selfSide = opts.peerLabel === 'A' ? 'a' : 'b';
    const otherSide = selfSide === 'a' ? 'b' : 'a';
    // Wir brechen die Peer-ID auf 63 Zeichen (PeerJS-Limit); appId + roomId
    // kommen gehasht rein wenn nötig — aber der User sollte die Adapter-Wahl
    // ohnehin klein halten. Hier: einfach zusammensetzen, User-Verantwortung.
    const selfId = `${opts.appId}-${opts.roomId}-${selfSide}`;
    const otherId = `${opts.appId}-${opts.roomId}-${otherSide}`;
    opts.onDiagnostic?.(`[peerjs] self="${selfId}" target="${otherId}"`);

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
        // Pre-open conn-Errors sind Retry-Rauschen — nicht durchreichen.
        if (!opened) return;
        opts.onError(err);
      });
    }

    function tryConnect() {
      if (closed || opened) return;
      try {
        const c = peer.connect(otherId);
        wire(c);
        conns.push(c);
      } catch (e) {
        opts.onError(e instanceof Error ? e : new Error(String(e)));
      }
    }

    peer.on('open', () => {
      opts.onDiagnostic?.(`[peerjs] broker open`);
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
        opts.onDiagnostic?.(`[peerjs] transient ${err.type} — retry`);
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(tryConnect, RETRY_DELAY_MS);
        return;
      }
      opts.onError(err);
      if (!opened) reject(err);
    });
  });
};
