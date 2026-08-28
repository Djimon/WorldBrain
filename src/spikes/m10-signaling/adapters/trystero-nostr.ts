// Trystero + Nostr (v0.25 API — assign-Properties, kein Tuple mehr).
// Ausgangs-Hypothese (D28). Import via `@trystero-p2p/nostr` — den Alias
// `trystero/nostr` gibt es zwar noch, aber der neue Pfad ist der stabile.
import type { AdapterFactory, AdapterHandle } from '../types';
// Room heißt im @trystero-p2p/core so, wird von /nostr re-exportiert. joinRoom
// ist eine JoinRoom<NostrRoomConfig>-Funktion — typeof reicht als Alias.
import type { Room, joinRoom as JoinRoomFn } from '@trystero-p2p/nostr';

export const trysteroNostrAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/nostr');
  reportTrysteroBrokerInfo(mod, 'nostr', opts);
  return joinTrystero(mod.joinRoom, mod.getRelaySockets, opts);
};

/**
 * Loggt die vollständige Broker-Connection-String: appId, roomId, computed
 * SHA-1-Topic (das ist der echte Namespace-Key den Trystero intern nutzt),
 * selfId, alle Ziel-Relay-URLs. Damit können zwei Seiten ihre Logs
 * vergleichen und sehen ob sie denselben Topic verwenden.
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

/** Trystero-intern: sha1(appId + '/' + roomId) hex — muss auf beiden Seiten identisch sein. */
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

  // JsonValue satisfies DataPayload — Ping-Payload ist {id:string, echo:boolean}.
  const action = room.makeAction<{ id: string; echo: boolean }>('ping');
  let opened = false;

  // v0.25: onPeerJoin und action.onMessage sind Properties, KEINE Method-Aufrufe.
  room.onPeerJoin = (peerId) => {
    if (!opened) { opened = true; opts.onOpen(); }
    opts.onDiagnostic?.(`peer joined: ${peerId}`);
  };
  action.onMessage = (data, ctx) => opts.onMessage(ctx.peerId, data);

  // Broker-Socket-Zustand nach 2/5/8s snapshotten — zeigt ob wir den Broker
  // überhaupt erreichen UND welche konkreten URLs verbunden sind (relay-Subset
  // ist entscheidend: zwei Peers müssen mindestens EINEN gemeinsamen Relay
  // offen haben, sonst sehen sie sich nie).
  const socketProbeTimers = [2000, 5000, 8000].map((delay) => window.setTimeout(() => {
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
