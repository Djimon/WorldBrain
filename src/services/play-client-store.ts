// M10-D29 (#372): Client-Store-Contract — nimmt Snapshot + Delta vom Host
// entgegen und hält einen FLÜCHTIGEN In-Memory-Store für die Play-Sichten
// des Spielers. KEIN DB-Zugriff (D30-Membran); der Client sieht keine
// lokale Datenbank, nur die vom Host geschickte Sicht.
//
// Dieses File definiert nur das Interface + Typen. Die konkrete Impl
// (play-client-store-memory) und die Verdrahtung an den Transport (R3)
// binden gegen DIESEN Vertrag.
import type { Delta, Snapshot, SyncEntity, SyncEntityKind } from './play-sync-protocol';

/**
 * PlayClientStore: der Client empfängt Snapshot + Delta und stellt
 * Read-Selektoren für die Views bereit. Kein autoritatives Schreiben —
 * Änderungen wandern als `ClientAction` zurück zum Host.
 */
export interface PlayClientStore {
  /** Initialer Zustand aus dem Snapshot übernehmen (Reset). */
  applySnapshot(snapshot: Snapshot): void;
  /** Einzel-Delta einweben (add/update/remove). */
  applyDelta(delta: Delta): void;

  /** Alle sichtbaren Entities einer Kategorie. */
  list(kind: SyncEntityKind): readonly SyncEntity[];
  /** Einzel-Zugriff (Detail-Sicht). null wenn nicht vorhanden/nicht sichtbar. */
  get(kind: SyncEntityKind, id: string): SyncEntity | null;
  /** Der eigene Charakter (Play-Cockpit „Bogen"-Tab), falls im Store. */
  ownCharacter(): SyncEntity | null;

  /** View-Abonnenten: die konkrete Impl darf einen Listener-Bus fahren. */
  subscribe(listener: () => void): () => void;

  /** Vollständig leeren (Disconnect / Session-Ende). */
  clear(): void;
}

/**
 * Fabrik-Vertrag: Consumer erzeugt sich seinen Store mit dem eigenen
 * playerId-Kontext; die Impl darf zwischen playerId und den empfangenen
 * Snapshots konsistent bleiben.
 */
export interface PlayClientStoreOptions {
  playerId: string;
}
