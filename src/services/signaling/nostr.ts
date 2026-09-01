// M10-S12 (#368): Trystero + Nostr — default strategy (Spike #380 primary).
// v0.25 API: makeAction returns an object (not a tuple), onPeerJoin is a property.
import type { Room, joinRoom as JoinRoomFn, JsonValue, MessageAction } from '@trystero-p2p/nostr';
import type { AdapterFactory, AdapterHandle } from './types';

// Trystero DataPayload = JsonValue | Blob | ArrayBuffer | ArrayBufferView.
// JSON is enough for signaling — narrow type, tsc-clean.
type JsonPayload = JsonValue;

export const nostrAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/nostr');
  return joinTrystero(mod.joinRoom, opts);
};

export async function joinTrystero(
  joinRoom: typeof JoinRoomFn,
  opts: Parameters<AdapterFactory>[0],
): Promise<AdapterHandle> {
  // joinRoom happens asynchronously via queueMicrotask — factory() returns
  // a handle immediately. This makes the adapter test-friendly (registry test in Node without
  // RTCPeerConnection), and real broker errors land as opts.onError instead
  // of a factory throw. Sends before the actual join are buffered.
  let room: Room | null = null;
  let action: MessageAction<JsonPayload> | null = null;
  const queued: JsonPayload[] = [];
  let closed = false;

  queueMicrotask(() => {
    if (closed) return;
    try {
      opts.onDiagnostic?.(`joinRoom({appId="${opts.appId}"}, roomId="${opts.roomId}")`);
      room = joinRoom({ appId: opts.appId }, opts.roomId);
      action = room.makeAction<JsonPayload>('sig');
      let opened = false;
      room.onPeerJoin = (peerId) => {
        if (!opened) { opened = true; opts.onOpen(); }
        opts.onDiagnostic?.(`peer joined: ${peerId}`);
      };
      action.onMessage = (data, ctx) => opts.onMessage(ctx.peerId, data);
      for (const p of queued) void action.send(p);
      queued.length = 0;
    } catch (e) {
      opts.onError(e instanceof Error ? e : new Error(String(e)));
    }
  });

  return {
    send(payload) {
      if (action) void action.send(payload as JsonPayload);
      else queued.push(payload as JsonPayload);
    },
    async close() {
      closed = true;
      if (room) await room.leave();
    },
  };
}
