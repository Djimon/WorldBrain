// Trystero + Nostr (v0.25 API — assign-Properties, kein Tuple mehr).
// Ausgangs-Hypothese (D28). Import via `@trystero-p2p/nostr` — den Alias
// `trystero/nostr` gibt es zwar noch, aber der neue Pfad ist der stabile.
import type { AdapterFactory, AdapterHandle } from '../types';
import type { TrysteroRoom, joinRoom as JoinRoomFn } from '@trystero-p2p/nostr';

export const trysteroNostrAdapter: AdapterFactory = async (opts) => {
  const { joinRoom } = await import('@trystero-p2p/nostr');
  return joinTrystero(joinRoom, opts);
};

export async function joinTrystero(
  joinRoom: typeof JoinRoomFn,
  opts: {
    roomId: string;
    peerLabel: string;
    onOpen: () => void;
    onMessage: (from: string, payload: unknown) => void;
    onError: (err: Error) => void;
  },
): Promise<AdapterHandle> {
  let room: TrysteroRoom;
  try {
    room = joinRoom({ appId: 'wbx-m10-signaling-spike' }, opts.roomId);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    opts.onError(err);
    throw err;
  }

  const action = room.makeAction<unknown>('ping');
  let opened = false;

  // v0.25: onPeerJoin und action.onMessage sind Properties, KEINE Method-Aufrufe.
  room.onPeerJoin = (peerId) => {
    if (!opened) { opened = true; opts.onOpen(); }
    void peerId; void opts.peerLabel;
  };
  action.onMessage = (data, ctx) => opts.onMessage(ctx.peerId, data);

  return {
    send(payload) { void action.send(payload); },
    async close() { await room.leave(); },
  };
}
