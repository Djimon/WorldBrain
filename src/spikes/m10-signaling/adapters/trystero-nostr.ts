// Trystero + Nostr (v0.25 API — assign-Properties, kein Tuple mehr).
// Ausgangs-Hypothese (D28). Import via `@trystero-p2p/nostr` — den Alias
// `trystero/nostr` gibt es zwar noch, aber der neue Pfad ist der stabile.
import type { AdapterFactory, AdapterHandle } from '../types';
// Room heißt im @trystero-p2p/core so, wird von /nostr re-exportiert. joinRoom
// ist eine JoinRoom<NostrRoomConfig>-Funktion — typeof reicht als Alias.
import type { Room, joinRoom as JoinRoomFn } from '@trystero-p2p/nostr';

export const trysteroNostrAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/nostr');
  reportTrysteroBrokerInfo(mod, 'nostr', opts.onDiagnostic);
  return joinTrystero(mod.joinRoom, mod.getRelaySockets, opts);
};

/**
 * Loggt statische Broker-Fakten (selfId, konfigurierte Relay-URLs). Falls Nutzer
 * eine Diagnostik-Senke reingibt, landen die dort — sonst nur console.
 */
export function reportTrysteroBrokerInfo(
  mod: { selfId: string; defaultRelayUrls: string[] },
  label: string,
  sink: ((s: string) => void) | undefined,
) {
  const line1 = `[trystero-${label}] selfId=${mod.selfId}`;
  const line2 = `[trystero-${label}] defaultRelayUrls (${mod.defaultRelayUrls.length}): ${mod.defaultRelayUrls.join(', ')}`;
  console.log(line1);
  console.log(line2);
  sink?.(line1);
  sink?.(line2);
}

export async function joinTrystero(
  joinRoom: typeof JoinRoomFn,
  getRelaySockets: () => Record<string, WebSocket> | undefined,
  opts: {
    roomId: string;
    peerLabel: string;
    onOpen: () => void;
    onMessage: (from: string, payload: unknown) => void;
    onError: (err: Error) => void;
    onDiagnostic?: (msg: string) => void;
  },
): Promise<AdapterHandle> {
  let room: Room;
  try {
    room = joinRoom({ appId: 'wbx-m10-signaling-spike' }, opts.roomId);
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

  // Broker-Socket-Zustand nach 2s + 5s snapshotten — zeigt ob wir den Broker
  // überhaupt erreichen (WebSocket.readyState: 0=connecting, 1=open, 2=closing, 3=closed).
  const socketProbeTimers = [2000, 5000].map((delay) => window.setTimeout(() => {
    if (opened) return;
    const sockets = getRelaySockets();
    if (!sockets || typeof sockets !== 'object') {
      opts.onDiagnostic?.(`relay sockets: none (getRelaySockets returned ${sockets})`);
      return;
    }
    const rows = Object.entries(sockets).map(([url, ws]) => {
      const state = ws?.readyState;
      const stateName = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][state ?? 3] ?? 'UNKNOWN';
      return `  ${stateName.padEnd(10)} ${url}`;
    });
    opts.onDiagnostic?.(`relay sockets @${delay}ms (${rows.length}):\n${rows.join('\n')}`);
  }, delay));

  return {
    send(payload) { void action.send(payload as { id: string; echo: boolean }); },
    async close() {
      socketProbeTimers.forEach((t) => window.clearTimeout(t));
      await room.leave();
    },
  };
}
