// Trystero v0.25 API (aus node_modules/@trystero-p2p/core/dist/types.d.mts):
// - joinRoom(config, roomId) → Room
// - Room.makeAction(name) → { send, onMessage } — Objekt, KEIN Tuple mehr
// - Room.onPeerJoin/onPeerLeave → assignable Properties (nicht callable)
// - Room.ping(peerId) → Promise<number> — native RTT-Ping
//
// MQTT + Torrent sind seit v0.25 SEPARATE Pakete (@trystero-p2p/*).
// Die Path-Re-Exports `trystero/mqtt` bzw `trystero/torrent` werfen einen
// Deprecation-Error — deshalb hier die neuen Paket-Namen shimmen.
declare module 'trystero/nostr' {
  export * from '@trystero-p2p/nostr';
}
declare module '@trystero-p2p/nostr' {
  export function joinRoom(config: TrysteroConfig, roomId: string): TrysteroRoom;
  export interface TrysteroConfig { appId: string; password?: string }
  export interface TrysteroRoom {
    makeAction<T = unknown>(namespace: string): TrysteroAction<T>;
    ping(peerId: string): Promise<number>;
    leave(): Promise<void>;
    getPeers(): Record<string, RTCPeerConnection>;
    onPeerJoin: ((peerId: string) => void) | null;
    onPeerLeave: ((peerId: string) => void) | null;
  }
  export interface TrysteroAction<T> {
    send(data: T, options?: unknown): Promise<void>;
    onMessage: ((data: T, ctx: { peerId: string }) => void) | null;
  }
}
declare module '@trystero-p2p/mqtt' {
  export * from '@trystero-p2p/nostr';
}
declare module '@trystero-p2p/torrent' {
  export * from '@trystero-p2p/nostr';
}
// PeerJS ist installiert — echte Typen aus `peerjs` reichen aus, keine Shim
// mehr nötig. (Vorherige Shim war unvollständig und hat den `.type`-Field auf
// PeerError versteckt — bei ihrem echten Import via `import { Peer, PeerError }
// from 'peerjs'` ist alles typisiert.)
