// M10-D28 (#380) signaling spike — throwaway harness.
// ONE adapter interface for all candidates (Trystero/Nostr, Trystero/MQTT,
// Trystero/BitTorrent, PeerJS, manual-SDP). This makes them all apples-to-apples
// behind the same facade — and the interchangeability for the D28 roadmap goal
// (v2/v3 self-hosted relay = another adapter) is demonstrated.
//
// After the spike the folder is discarded — only the written finding
// (planning/research/multiplayer-signaling-broker-options.md) remains.

export type AdapterKey =
  | 'trystero-nostr'
  | 'trystero-mqtt'
  | 'trystero-bittorrent'
  | 'peerjs'
  | 'manual-sdp';

export interface AdapterFactoryOpts {
  /** Two peers count as "in the same room" when roomId is identical. */
  roomId: string;
  /** Candidate-local peer ID; display/debug, not a security property. */
  peerLabel: string;
  /** Fires as soon as at least ONE DataChannel is `open` (success marker). */
  onOpen: () => void;
  /** Fires on payload receipt; the bench uses it for the ping RTT. */
  onMessage: (from: string, payload: unknown) => void;
  /** Fatal/soft errors that the bench should count as a fail. */
  onError: (err: Error) => void;
  /** For manual-SDP: the UI must render a panel for copy-paste. */
  requestUiPanel?: (panel: ManualSdpPanel) => void;
  /** Broker visibility — the adapter logs selfId, relay URLs, socket states. */
  onDiagnostic?: (msg: string) => void;
  /** appId for broker namespacing. Trystero: joinRoom({appId}, roomId). */
  appId: string;
}

export interface AdapterHandle {
  /** Broadcast to all known peers in the room. */
  send(payload: unknown): void;
  /** Close the adapter cleanly (the cold-start bench has to close often). */
  close(): Promise<void>;
}

export interface ManualSdpPanel {
  role: 'offer' | 'answer';
  /** Blob to display to the user. */
  localBlob: string;
  /** Callback when the user pastes the remote answer. */
  onRemoteBlob(blob: string): void;
}

export type AdapterFactory = (opts: AdapterFactoryOpts) => Promise<AdapterHandle>;
