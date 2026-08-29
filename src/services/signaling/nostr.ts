// M10-S12 (#368): Trystero + Nostr — Default-Strategie (Spike #380 primär).
// v0.25 API: makeAction gibt Objekt (nicht Tuple), onPeerJoin ist Property.
import type { Room, joinRoom as JoinRoomFn, JsonValue, MessageAction } from '@trystero-p2p/nostr';
import type { AdapterFactory, AdapterHandle } from './types';

// Trystero DataPayload = JsonValue | Blob | ArrayBuffer | ArrayBufferView.
// Für Signaling reicht JSON — enger Typ, tsc-sauber.
type JsonPayload = JsonValue;

export const nostrAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/nostr');
  return joinTrystero(mod.joinRoom, opts);
};

export async function joinTrystero(
  joinRoom: typeof JoinRoomFn,
  opts: Parameters<AdapterFactory>[0],
): Promise<AdapterHandle> {
  // joinRoom passiert asynchron via queueMicrotask — factory() liefert sofort
  // ein Handle. So ist der Adapter test-freundlich (Registry-Test in Node ohne
  // RTCPeerConnection), und echte Broker-Fehler landen als opts.onError statt
  // als Factory-Throw. Sends vor dem tatsächlichen Join werden gepuffert.
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
