// M10-D29 (#372): Sync-Vertrag zwischen Host (R2) und Client (R3).
// Reine Typen — keine Logik, kein DB-Zugriff. Host und Client binden ihre
// Impl-Module (play-host-broker, play-client-store) an DIESE Typen; damit
// bleibt die Membran zwischen beiden Seiten stabil.
//
// Bewusst KEIN DB-Import — der Client kennt keine lokale Persistenz-Schicht
// (D30-Membran). Der Host serialisiert seine authoritative Sicht in diese
// Nachrichten und schickt sie durch den Transport.

/** Fachliche Kategorien der übertragenen Daten (Play-Cockpit-Subset D15). */
export type SyncEntityKind =
  | 'entity'
  | 'map'
  | 'marker'
  | 'token'
  | 'calendar_event'
  | 'handout'
  | 'combat_log'
  | 'whiteboard_element'
  | 'session_time'
  | 'player_character';

/** Ein Datenobjekt in der Sync-Membran — vom Host bereits gefiltert
 *  (S07-Visibility, S17-Kalender-Gate); Payload ist bewusst opake. */
export interface SyncEntity {
  kind: SyncEntityKind;
  id: string;
  data: Record<string, unknown>;
}

/**
 * Snapshot: initialer, für EINEN Empfänger host-gefilterter Datensatz.
 * Enthält nur, was der Spieler zum Zeitpunkt des Joins/Reconnects sehen darf.
 */
export interface Snapshot {
  type: 'snapshot';
  campaignId: string;
  recipientPlayerId: string;
  serverTime: string;
  entities: SyncEntity[];
}

/**
 * Delta: inkrementelle Änderung (Add/Update/Remove) EINES freigegebenen
 * Objekts. `kind` beschreibt die Fach-Kategorie; `op` die Änderung.
 * Sondertypen (Token-Bewegung, Kampflog-Eintrag, Session-Zeit-Vorstellung,
 * Whiteboard-Placement) sind normale add/update-Deltas mit passendem `kind`.
 */
export type DeltaOp = 'add' | 'update' | 'remove';

export interface Delta {
  type: 'delta';
  campaignId: string;
  op: DeltaOp;
  kind: SyncEntityKind;
  id: string;
  data?: Record<string, unknown>;
  serverTime: string;
}

/**
 * ClientAction: Spieler→Host-Intent (Würfeln, eigene Token-Bewegung, eigener
 * Bogen-Edit). Der Host ist autoritativ — er validiert, führt aus und
 * antwortet mit `Delta`s an die berechtigten Empfänger.
 */
export type ClientActionKind =
  | 'roll_dice'
  | 'move_own_token'
  | 'edit_own_sheet'
  | 'post_private_note'
  | 'whiteboard_place';

export interface ClientAction {
  type: 'client_action';
  actionKind: ClientActionKind;
  senderPlayerId: string;
  campaignId: string;
  payload: Record<string, unknown>;
  clientTime: string;
}

/** Jede Nachricht in der Membran ist genau eine dieser drei. */
export type SyncMessage = Snapshot | Delta | ClientAction;
