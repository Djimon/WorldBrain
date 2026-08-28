// M10-D28 (#380) Signaling-Spike — throwaway harness.
// EINE Adapter-Schnittstelle für alle Kandidaten (Trystero/Nostr, Trystero/MQTT,
// Trystero/BitTorrent, PeerJS, manual-SDP). Damit sind alle apples-to-apples
// hinter derselben Fassade — und die Austauschbarkeit fürs D28-Roadmap-Ziel
// (v2/v3 self-hosted Relay = weiterer Adapter) ist demonstriert.
//
// Nach dem Spike wird der Ordner verworfen — nur der schriftliche Befund
// (planning/research/multiplayer-signaling-broker-options.md) bleibt.

export type AdapterKey =
  | 'trystero-nostr'
  | 'trystero-mqtt'
  | 'trystero-bittorrent'
  | 'peerjs'
  | 'manual-sdp';

export interface AdapterFactoryOpts {
  /** Zwei Peers gelten als „im selben Raum" wenn roomId identisch. */
  roomId: string;
  /** Kandidat-lokale Peer-ID; Anzeige/Debug, kein Sicherheitsmerkmal. */
  peerLabel: string;
  /** Feuert sobald mindestens EIN DataChannel `open` ist (Erfolgsmarker). */
  onOpen: () => void;
  /** Feuert bei Payload-Empfang; Bench nutzt es fürs Ping-RTT. */
  onMessage: (from: string, payload: unknown) => void;
  /** Fatale/soft Fehler, die der Bench als Fail werten sollte. */
  onError: (err: Error) => void;
  /** Für manual-SDP: die UI muss ein Panel für Copy/Paste rendern. */
  requestUiPanel?: (panel: ManualSdpPanel) => void;
}

export interface AdapterHandle {
  /** Broadcast an alle bekannten Peers im Raum. */
  send(payload: unknown): void;
  /** Adapter sauber schließen (Cold-Start-Bench muss oft schließen). */
  close(): Promise<void>;
}

export interface ManualSdpPanel {
  role: 'offer' | 'answer';
  /** Blob zum Anzeigen für den User. */
  localBlob: string;
  /** Callback wenn der User die Remote-Antwort einfügt. */
  onRemoteBlob(blob: string): void;
}

export type AdapterFactory = (opts: AdapterFactoryOpts) => Promise<AdapterHandle>;
