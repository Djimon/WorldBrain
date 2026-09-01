// M10-D29 (#372): Client store contract — receives snapshot + delta from the
// host and keeps a VOLATILE in-memory store for the player's play
// views. NO DB access (D30 membrane); the client sees no
// local database, only the view sent by the host.
//
// This file defines only the interface + types. The concrete impl
// (play-client-store-memory) and the wiring to the transport (R3)
// bind against THIS contract.
import type { Delta, Snapshot, SyncEntity, SyncEntityKind } from './play-sync-protocol';

/**
 * PlayClientStore: the client receives snapshot + delta and provides
 * read selectors for the views. No authoritative writes —
 * changes travel back to the host as a `ClientAction`.
 */
export interface PlayClientStore {
  /** Adopt the initial state from the snapshot (reset). */
  applySnapshot(snapshot: Snapshot): void;
  /** Weave in a single delta (add/update/remove). */
  applyDelta(delta: Delta): void;

  /** All visible entities of a category. */
  list(kind: SyncEntityKind): readonly SyncEntity[];
  /** Single access (detail view). null if absent/not visible. */
  get(kind: SyncEntityKind, id: string): SyncEntity | null;
  /** The player's own character (play-cockpit "sheet" tab), if in the store. */
  ownCharacter(): SyncEntity | null;

  /** View subscribers: the concrete impl may run a listener bus. */
  subscribe(listener: () => void): () => void;

  /** Fully clear (disconnect / session end). */
  clear(): void;
}

/**
 * Factory contract: the consumer creates its store with its own
 * playerId context; the impl may stay consistent between playerId and the
 * received snapshots.
 */
export interface PlayClientStoreOptions {
  playerId?: string;
}

// --------------------------------------------------------------------------
// Concrete in-memory impl. No persistent state — an empty store indicates
// "offline"; once a snapshot arrives, the store counts as connected.
// --------------------------------------------------------------------------

interface EntityKey { kind: SyncEntityKind; id: string }
function keyOf(k: EntityKey): string { return `${k.kind}::${k.id}`; }

/**
 * Extended interface with the additional test-satisfying methods.
 * `getEntities` returns all entities across all categories flat;
 * `isOffline` returns true as long as no snapshot has been received yet.
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
