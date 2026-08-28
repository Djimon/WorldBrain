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
  playerId?: string;
}

// --------------------------------------------------------------------------
// Konkrete In-Memory-Impl. Kein persistenter Zustand — leerer Store zeigt
// „offline" an; sobald ein Snapshot reinkommt, gilt der Store als verbunden.
// --------------------------------------------------------------------------

interface EntityKey { kind: SyncEntityKind; id: string }
function keyOf(k: EntityKey): string { return `${k.kind}::${k.id}`; }

/**
 * Erweiterte Schnittstelle mit den zusätzlichen Test-erfüllenden Methoden.
 * `getEntities` gibt alle Entities über alle Kategorien flach zurück;
 * `isOffline` liefert true, solange noch kein Snapshot empfangen wurde.
 */
export interface PlayClientStoreImpl extends PlayClientStore {
  getEntities(): readonly SyncEntity[];
  isOffline(): boolean;
  handleSnapshot(snapshot: Snapshot): void;
}

export function createPlayClientStore(_options: PlayClientStoreOptions = {}): PlayClientStoreImpl {
  const items = new Map<string, SyncEntity>();
  const listeners = new Set<() => void>();
  let ownPlayerId = _options.playerId ?? null;
  let online = false;
  let ownChar: SyncEntity | null = null;

  function notify(): void {
    for (const l of listeners) { try { l(); } catch { /* isolate */ } }
  }

  function applySnapshot(snapshot: Snapshot): void {
    items.clear();
    for (const e of snapshot.entities) items.set(keyOf(e), e);
    online = true;
    ownPlayerId = snapshot.recipientPlayerId;
    ownChar = null;
    for (const e of snapshot.entities) {
      if (e.kind === 'player_character' && e.data.player_id === ownPlayerId) {
        ownChar = e;
        break;
      }
    }
    notify();
  }

  function applyDelta(delta: Delta): void {
    const key = keyOf({ kind: delta.kind, id: delta.id });
    if (delta.op === 'remove') items.delete(key);
    else if (delta.data !== undefined) items.set(key, { kind: delta.kind, id: delta.id, data: delta.data });
    if (delta.kind === 'player_character') {
      const item = items.get(key) ?? null;
      if (item && item.data.player_id === ownPlayerId) ownChar = item;
    }
    notify();
  }

  return {
    applySnapshot,
    applyDelta,
    handleSnapshot: applySnapshot,
    list(kind) { return Array.from(items.values()).filter((e) => e.kind === kind); },
    get(kind, id) { return items.get(keyOf({ kind, id })) ?? null; },
    ownCharacter() { return ownChar; },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    clear() { items.clear(); online = false; ownChar = null; notify(); },
    getEntities() { return Array.from(items.values()); },
    isOffline() { return !online; },
  };
}
