// M10-S12 (#368): Signaling-Adapter-Layer — Interface + Vertrag.
// Ein Adapter versteckt einen konkreten Broker (Trystero-Nostr, MQTT, Torrent,
// PeerJS-Cloud) hinter EINER Fassade — der Transport (#367) redet nur gegen
// diese Fassade und wählt den Broker per `AdapterKey`.
//
// Namespacing kommt von außen (#367): `appId` = per-Host-Namespace,
// `roomId` = Campaign-Name. Der Layer behandelt beide OPAK.
//
// Manueller SDP-Copy/Paste wurde nie validiert (Spike #380) und ist gestrichen
// — kein `requestUiPanel`, kein `ManualSdpPanel`, kein `manual-sdp`-Adapter.

export type AdapterKey = 'nostr' | 'mqtt' | 'bittorrent' | 'peerjs';

export interface AdapterFactoryOpts {
  /** Broker-Namespace: kommt vom Host (`getHostSecret`-abgeleitet, #367). */
  appId: string;
  /** Campaign-Name als Broker-Room. Der DM wählt ihn frei. */
  roomId: string;
  /** Rollen-Marker `A|B` (nur für Adapter, die Rollen brauchen — z.B. PeerJS). */
  peerLabel: 'A' | 'B';
  /** Feuert wenn der erste Peer den Raum joined (Verbindung offen). */
  onOpen: () => void;
  /** Payload-Empfang vom anderen Peer. */
  onMessage: (from: string, payload: unknown) => void;
  /** Fatale/soft Fehler die der Aufrufer werten soll. */
  onError: (err: Error) => void;
  /** Optional: broker-interne Diagnostik (selfId, Relay-Status, Retries). */
  onDiagnostic?: (msg: string) => void;
}

export interface AdapterHandle {
  /** Payload broadcast an alle bekannten Peers im Raum. */
  send(payload: unknown): void;
  /** Sauberer Shutdown — Adapter räumt Relay-Sockets/Peer-Refs auf. */
  close(): Promise<void>;
}

export type AdapterFactory = (opts: AdapterFactoryOpts) => Promise<AdapterHandle>;

/**
 * Feste, geordnete Strategie-Kette für den Fallback-Orchestrator.
 * BEIDE Peers MÜSSEN diese identische Reihenfolge laufen — sonst landen sie
 * auf verschiedenen Relays und finden sich nie.
 * PeerJS ist Backup jenseits der Trystero-Kette.
 */
export const STRATEGY_ORDER: AdapterKey[] = ['nostr', 'mqtt', 'bittorrent', 'peerjs'];
