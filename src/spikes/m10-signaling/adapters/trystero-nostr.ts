// Trystero + Nostr (v0.25 API — assign properties, no more tuple).
// Starting hypothesis (D28). Import via `@trystero-p2p/nostr` — the alias
// `trystero/nostr` does still exist, but the new path is the stable one.
import type { AdapterFactory, AdapterHandle } from '../types';
// Room is named this way in @trystero-p2p/core, re-exported by /nostr. joinRoom
// is a JoinRoom<NostrRoomConfig> function — typeof is enough as an alias.
import type { Room, joinRoom as JoinRoomFn } from '@trystero-p2p/nostr';

export const trysteroNostrAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/nostr');
  reportTrysteroBrokerInfo(mod, 'nostr', opts);
  return joinTrystero(mod.joinRoom, mod.getRelaySockets, opts);
};

/**
 * Logs the full broker connection string: appId, roomId, computed
 * SHA-1 topic (that is the real namespace key Trystero uses internally),
 * selfId, all target relay URLs. With this two sides can compare their logs
 * and see whether they use the same topic.
 */
export async function reportTrysteroBrokerInfo(
  mod: { selfId: string; defaultRelayUrls: string[] },
  label: string,
  opts: { appId: string; roomId: string; onDiagnostic?: (s: string) => void },
) {
  const sink = opts.onDiagnostic;
  const topic = await computeTrysteroTopic(opts.appId, opts.roomId);
  const lines = [
    `[trystero-${label}] === CONNECTION STRING ===`,
    `[trystero-${label}]   appId       = "${opts.appId}"`,
    `[trystero-${label}]   roomId      = "${opts.roomId}"`,
    `[trystero-${label}]   topic (sha1) = ${topic}   <- BEIDE Seiten müssen denselben Topic haben`,
    `[trystero-${label}]   selfId      = ${mod.selfId}`,
    `[trystero-${label}] defaultRelayUrls (${mod.defaultRelayUrls.length}): ${mod.defaultRelayUrls.join(', ')}`,
  ];
  for (const l of lines) { console.log(l); sink?.(l); }
}

/** Trystero-internal: sha1(appId + '/' + roomId) hex — must be identical on both sides. */
async function computeTrysteroTopic(appId: string, roomId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${appId}/${roomId}`);
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function joinTrystero(
  joinRoom: typeof JoinRoomFn,
  getRelaySockets: () => Record<string, WebSocket> | undefined,
  opts: {
    roomId: string;
    peerLabel: string;
    appId: string;
    onOpen: () => void;
    onMessage: (from: string, payload: unknown) => void;
    onError: (err: Error) => void;
    onDiagnostic?: (msg: string) => void;
  },
): Promise<AdapterHandle> {
  let room: Room;
  try {
    opts.onDiagnostic?.(`joinRoom({appId="${opts.appId}"}, roomId="${opts.roomId}") — calling…`);
    room = joinRoom({ appId: opts.appId }, opts.roomId);
    opts.onDiagnostic?.(`joinRoom returned — waiting for peer to appear on any relay…`);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    opts.onError(err);
    throw err;
  }

  // JsonValue satisfies DataPayload — the ping payload is {id:string, echo:boolean}.
  const action = room.makeAction<{ id: string; echo: boolean }>('ping');
  let opened = false;

  // v0.25: onPeerJoin and action.onMessage are properties, NOT method calls.
  room.onPeerJoin = (peerId) => {
    if (!opened) { opened = true; opts.onOpen(); }
    opts.onDiagnostic?.(`peer joined: ${peerId}`);
  };
  action.onMessage = (data, ctx) => opts.onMessage(ctx.peerId, data);

  // Snapshot the broker socket state at 2/5/10/15s — shows whether we reach the broker
  // at all AND which concrete URLs are connected (the relay subset
  // is decisive: two peers must have at least ONE shared relay
  // open, otherwise they never see each other). More probes to match the 20s timeout.
  const socketProbeTimers = [2000, 5000, 10000, 15000].map((delay) => window.setTimeout(() => {
    if (opened) return;
    const sockets = getRelaySockets();
    if (!sockets || typeof sockets !== 'object') {
      opts.onDiagnostic?.(`relay sockets @${delay}ms: none (getRelaySockets returned ${sockets})`);
      return;
    }
    const rows = Object.entries(sockets).map(([url, ws]) => {
      const state = ws?.readyState;
      const stateName = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][state ?? 3] ?? 'UNKNOWN';
      return `  ${stateName.padEnd(10)} ${url}`;
    });
    const openCount = rows.filter((r) => r.startsWith('  OPEN')).length;
    opts.onDiagnostic?.(`relay sockets @${delay}ms — ${openCount}/${rows.length} OPEN:\n${rows.join('\n')}`);
  }, delay));

  return {
    send(payload) { void action.send(payload as { id: string; echo: boolean }); },
    async close() {
      socketProbeTimers.forEach((t) => window.clearTimeout(t));
      await room.leave();
    },
  };
}
