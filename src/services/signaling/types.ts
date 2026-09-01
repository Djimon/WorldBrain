// M10-S12 (#368): Signaling adapter layer — interface + contract.
// An adapter hides a concrete broker (Trystero-Nostr, MQTT, Torrent,
// PeerJS-Cloud) behind ONE facade — the transport (#367) talks only against
// this facade and picks the broker by `AdapterKey`.
//
// Namespacing comes from outside (#367): `appId` = per-host namespace,
// `roomId` = campaign name. The layer treats both as OPAQUE.
//
// Manual SDP copy/paste was never validated (Spike #380) and is removed
// — no `requestUiPanel`, no `ManualSdpPanel`, no `manual-sdp` adapter.

export type AdapterKey = 'nostr' | 'mqtt' | 'bittorrent' | 'peerjs';

export interface AdapterFactoryOpts {
  /** Broker namespace: comes from the host (derived from `getHostSecret`, #367). */
  appId: string;
  /** Campaign name as the broker room. The DM chooses it freely. */
  roomId: string;
  /** Role marker `A|B` (only for adapters that need roles — e.g. PeerJS). */
  peerLabel: 'A' | 'B';
  /** Fires when the first peer joins the room (connection open). */
  onOpen: () => void;
  /** Payload reception from the other peer. */
  onMessage: (from: string, payload: unknown) => void;
  /** Fatal/soft errors the caller should evaluate. */
  onError: (err: Error) => void;
  /** Optional: broker-internal diagnostics (selfId, relay status, retries). */
  onDiagnostic?: (msg: string) => void;
}

export interface AdapterHandle {
  /** Payload broadcast to all known peers in the room. */
  send(payload: unknown): void;
  /** Clean shutdown — the adapter cleans up relay sockets/peer refs. */
  close(): Promise<void>;
}

export type AdapterFactory = (opts: AdapterFactoryOpts) => Promise<AdapterHandle>;

/**
 * Fixed, ordered strategy chain for the fallback orchestrator.
 * BOTH peers MUST run this identical order — otherwise they land
 * on different relays and never find each other.
 * PeerJS is the backup beyond the Trystero chain.
 */
export const STRATEGY_ORDER: AdapterKey[] = ['nostr', 'mqtt', 'bittorrent', 'peerjs'];
