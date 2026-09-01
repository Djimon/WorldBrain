// M10-S12 (#368): PeerJS-Cloud — backup broker (Spike 9-10/10, ~216ms).
// No appId namespace at the broker → the salted prefix must go DIRECTLY into the peer ID.
// Hence: `${appId}-${roomId}-${peerLabel}` as the full peer ID.
import { Peer, PeerError } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { AdapterFactory, AdapterHandle } from './types';

const RETRY_DELAY_MS = 500;
const TRANSIENT_ERRORS = new Set(['peer-unavailable', 'unavailable-id']);

export const peerjsAdapter: AdapterFactory = async (opts) => {
  return new Promise<AdapterHandle>((resolve, reject) => {
    const selfSide = opts.peerLabel === 'A' ? 'a' : 'b';
    const otherSide = selfSide === 'a' ? 'b' : 'a';
    // We cap the peer ID at 63 characters (PeerJS limit); appId + roomId
    // come in hashed if needed — but the user should keep the adapter choice
    // small anyway. Here: just concatenate, user's responsibility.
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
        // Pre-open conn errors are retry noise — do not pass through.
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
