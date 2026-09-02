// @vitest-environment node
// M10 (#387): DB-loser Join/Auth als Transport-Handshake
// See: https://github.com/Djimon/WorldBrain/issues/387

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { applyMapSchema } from '../core_data/map-schema';
import { createToken } from '../src/services/map-token-service';
import { createLoopbackTransport } from '../src/services/loopback-transport';
import { createPlayClientStore } from '../src/services/play-client-store';
import { attachClientStoreToTransport } from '../src/services/client-store-transport-bridge';
import { attachHostTokenSync, sendMoveIntent } from '../src/services/host-token-sync';
import { pushPresentedMapSnapshot } from '../src/services/presented-map-push';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

const runtimeSchemaSql = readFileSync(
  new URL('../src/data/runtime/schema.sql', import.meta.url),
  'utf8',
);

function createHostDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

// ---------------------------------------------------------------------------
// Minimal loopback transport for tests
// ---------------------------------------------------------------------------

interface Msg { type: string; token?: string; payload: unknown }

function createLoopbackPair() {
  const hostInbox: Msg[] = [];
  const playerInbox: Msg[] = [];
  const hostListeners: Array<(m: Msg) => void> = [];
  const playerListeners: Array<(m: Msg) => void> = [];

  // send() liefert Promise<void> gemäß dem SessionTransport-Vertrag — der Host-
  // Broadcast (broadcastMovement/pushPresentedMapSnapshot) nutzt `.catch()`.
  const hostTransport = {
    send(m: Msg): Promise<void> { playerInbox.push(m); for (const l of playerListeners) l(m); return Promise.resolve(); },
    onMessage(fn: (m: Msg) => void) { hostListeners.push(fn); },
  };
  const playerTransport = {
    send(m: Msg): Promise<void> { hostInbox.push(m); for (const l of hostListeners) l(m); return Promise.resolve(); },
    onMessage(fn: (m: Msg) => void) { playerListeners.push(fn); },
  };

  return { hostTransport, playerTransport, hostInbox, playerInbox };
}

// ---------------------------------------------------------------------------
// 1. Loopback E2E: join_request → join_response{ok:true} + snapshot
// ---------------------------------------------------------------------------

describe('#387 Loopback E2E join handshake', () => {
  async function getHostJoinSync() {
    return import('../src/services/host-join-sync');
  }
  async function getIdentity() {
    return import('../src/services/session-identity-service');
  }

  it('player sends join_request → host responds with ok:true + token + snapshot', async () => {
    const { asyncDb, db } = createHostDb();
    try {
      const identity = await getIdentity();
      const hostSync = await getHostJoinSync();
      const { hostTransport, playerTransport, playerInbox } = createLoopbackPair();

      const code = await identity.generateInviteCode(asyncDb, { campaignId: 'c1' });

      // #412: the initial-scene push is injected by the caller (as WorkspaceShell does
      // behind feature('maps')) — host-join-sync itself is map-free session-core now.
      hostSync.attachHostJoinSync({
        transport: hostTransport as never,
        database: asyncDb,
        campaignId: 'c1',
        onAfterJoin: (playerId) =>
          pushPresentedMapSnapshot({ database: asyncDb, campaignId: 'c1', transport: hostTransport as never, recipientPlayerId: playerId }),
      });

      playerTransport.send({
        type: 'join_request',
        payload: { code, displayName: 'Alice' },
      });

      await new Promise<void>((r) => setTimeout(r, 50));

      const joinResp = playerInbox.find((m) => m.type === 'join_response');
      expect(joinResp).toBeTruthy();
      expect((joinResp!.payload as { ok: boolean }).ok).toBe(true);
      expect((joinResp!.payload as { token: string }).token).toBeTruthy();

      const snapshot = playerInbox.find((m) => m.type === 'snapshot');
      expect(snapshot).toBeTruthy();
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Invalid code → join_response{ok:false}, no session_players entry
// ---------------------------------------------------------------------------

describe('#387 Invalid code rejection', () => {
  async function getHostJoinSync() {
    return import('../src/services/host-join-sync');
  }

  it('unknown code → ok:false, no DB entry', async () => {
    const { asyncDb, db } = createHostDb();
    try {
      const hostSync = await getHostJoinSync();
      const { hostTransport, playerTransport, playerInbox } = createLoopbackPair();

      hostSync.attachHostJoinSync({
        transport: hostTransport as never,
        database: asyncDb,
        campaignId: 'c1',
      });

      playerTransport.send({
        type: 'join_request',
        payload: { code: 'INVALID', displayName: 'Bob' },
      });

      await new Promise<void>((r) => setTimeout(r, 50));

      const resp = playerInbox.find((m) => m.type === 'join_response');
      expect(resp).toBeTruthy();
      expect((resp!.payload as { ok: boolean }).ok).toBe(false);

      const players = await asyncDb.select<{ id: string }>(
        "SELECT id FROM session_players WHERE campaign_id = 'c1'",
      );
      expect(players).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Auth after join: player token-move intent authorized
// ---------------------------------------------------------------------------

describe('#387 Auth after join', () => {
  async function getHostJoinSync() {
    return import('../src/services/host-join-sync');
  }
  async function getIdentity() {
    return import('../src/services/session-identity-service');
  }
  async function getHostTokenSync() {
    return import('../src/services/host-token-sync');
  }

  it('after handshake, player token-move intent is authorized by host', async () => {
    const { asyncDb, db } = createHostDb();
    // map_tokens liegt im Map-Schema (nicht im Runtime-Schema) — der Move
    // persistiert die Ground Truth dort, bevor er gebroadcastet wird.
    applyMapSchema(db);
    db.prepare("INSERT INTO maps (id, title, image_width_px, image_height_px) VALUES ('m1','M',100,100)").run();
    try {
      const identity = await getIdentity();
      const hostSync = await getHostJoinSync();
      const tokenSync = await getHostTokenSync();
      const { hostTransport, playerTransport, playerInbox } = createLoopbackPair();

      const code = await identity.generateInviteCode(asyncDb, { campaignId: 'c1' });
      const { id: tokenId } = await createToken(asyncDb, { map_id: 'm1', x: 0, y: 0 });

      hostSync.attachHostJoinSync({
        transport: hostTransport as never,
        database: asyncDb,
        campaignId: 'c1',
      });
      tokenSync.attachHostTokenSync({
        transport: hostTransport as never,
        database: asyncDb,
        campaignId: 'c1',
      });

      playerTransport.send({
        type: 'join_request',
        payload: { code, displayName: 'Alice' },
      });
      await new Promise<void>((r) => setTimeout(r, 50));

      const joinResp = playerInbox.find((m) => m.type === 'join_response');
      const { token, playerId } = joinResp!.payload as { token: string; playerId: string };

      // Move-Intent über den ECHTEN Contract (sendMoveIntent → client_action mit
      // actionKind:'move_own_token'), nicht hand-gerollt — so wie #386 ihn nutzt.
      tokenSync.sendMoveIntent(playerTransport as never, {
        campaignId: 'c1',
        senderPlayerId: playerId,
        tokenId,
        x: 100,
        y: 200,
        token,
      });
      await new Promise<void>((r) => setTimeout(r, 50));

      const moveDelta = playerInbox.find((m) => m.type === 'delta' || m.type === 'token_move_broadcast');
      expect(moveDelta).toBeTruthy();
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Regression guard: PlayerJoinView has no database prop / DB calls
// ---------------------------------------------------------------------------

describe('#387 PlayerJoinView DB-guard', () => {
  it('PlayerJoinView has no database prop', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/database\s*[?:]\s*DatabaseLike/);
  });

  it('PlayerJoinView does not call joinWithCode', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/joinWithCode\s*\(/);
  });

  it('PlayerJoinView does not call reconnectSession', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/reconnectSession\s*\(/);
  });

  it('PlayerJoinView does not call pingHost', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/pingHost\s*\(/);
  });

  it('PlayerJoinView does not import DatabaseLike', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/import.*DatabaseLike/);
  });
});

// ---------------------------------------------------------------------------
// 5. Review-Severes #1/#2 — gegen den ECHTEN Transport (createLoopbackTransport:
//    Multi-Listener + Receive-Replay, treu zum WebRtcTransport). Der Inline-
//    Loopback oben verdeckte beide Bugs (Listener-Array ohne Single-Handler-
//    Semantik). Diese Tests fangen sie.
// ---------------------------------------------------------------------------

describe('#387 real-transport regression (Review #1/#2)', () => {
  async function getHostJoinSync() {
    return import('../src/services/host-join-sync');
  }
  async function getIdentity() {
    return import('../src/services/session-identity-service');
  }

  it('#1 host: attachHostJoinSync does NOT kill attachHostTokenSync — both handlers stay live', async () => {
    const { asyncDb, db } = createHostDb();
    applyMapSchema(db);
    db.prepare("INSERT INTO maps (id, title, image_width_px, image_height_px) VALUES ('m1','M',100,100)").run();
    try {
      const identity = await getIdentity();
      const { attachHostJoinSync } = await getHostJoinSync();
      const { clientSide, hostSide } = createLoopbackTransport();

      const code = await identity.generateInviteCode(asyncDb, { campaignId: 'c1' });
      const { id: tokenId } = await createToken(asyncDb, { map_id: 'm1', x: 0, y: 0 });

      // Reihenfolge wie in WorkspaceShell: token-sync ZUERST, join-sync DANACH
      // (genau die Registrierung, die den token-sync-Handler tötete).
      attachHostTokenSync({ transport: hostSide, database: asyncDb, campaignId: 'c1' });
      attachHostJoinSync({ transport: hostSide, database: asyncDb, campaignId: 'c1' });

      const received: Array<{ type: string; payload: unknown }> = [];
      clientSide.onMessage((m) => received.push(m));

      await clientSide.send({ type: 'join_request', token: 'handshake', payload: { code, displayName: 'Alice' } });
      await new Promise<void>((r) => setTimeout(r, 40));
      const joinResp = received.find((m) => m.type === 'join_response');
      expect(joinResp).toBeTruthy();
      const { token, playerId } = joinResp!.payload as { token: string; playerId: string };

      sendMoveIntent(clientSide, { campaignId: 'c1', senderPlayerId: playerId, tokenId, x: 42, y: 7, token });
      await new Promise<void>((r) => setTimeout(r, 40));
      // token-sync ist NICHT tot → der Move wird autorisiert und als Delta gebroadcastet.
      expect(received.find((m) => m.type === 'delta')).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it('#2 player: a late-attached client store still receives the join snapshot (receive-replay)', async () => {
    const { asyncDb, db } = createHostDb();
    try {
      const identity = await getIdentity();
      const { attachHostJoinSync } = await getHostJoinSync();
      const { clientSide, hostSide } = createLoopbackTransport();

      const code = await identity.generateInviteCode(asyncDb, { campaignId: 'c1' });
      attachHostJoinSync({
        transport: hostSide,
        database: asyncDb,
        campaignId: 'c1',
        onAfterJoin: (playerId) =>
          pushPresentedMapSnapshot({ database: asyncDb, campaignId: 'c1', transport: hostSide, recipientPlayerId: playerId }),
      });

      // Player hört zunächst NUR auf die join_response (wie PlayerJoinView) — noch
      // KEIN Store. Der Host schickt join_response + Snapshot direkt hintereinander.
      const received: Array<{ type: string }> = [];
      clientSide.onMessage((m) => received.push(m));
      await clientSide.send({ type: 'join_request', token: 'handshake', payload: { code, displayName: 'Alice' } });
      await new Promise<void>((r) => setTimeout(r, 40));
      expect(received.find((m) => m.type === 'join_response')).toBeTruthy();

      // Store-Bridge SPÄT anhängen (wie die Shell erst 2 Effekt-Zyklen später).
      const store = createPlayClientStore({});
      expect(store.isOffline()).toBe(true);
      attachClientStoreToTransport(clientSide, store);
      await new Promise<void>((r) => setTimeout(r, 10));
      // Ohne Receive-Replay wäre der Snapshot verloren → Store bliebe offline.
      expect(store.isOffline()).toBe(false);
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. #412 decoupling guard — host-join-sync is session-core and MUST NOT import
//    map-feature code (that would pull map-service into the main bundle again).
// ---------------------------------------------------------------------------

describe('#412 host-join-sync stays map-free', () => {
  it('imports no map-feature module (presented-map-push / map-*-service)', () => {
    const src = readFileSync('src/services/host-join-sync.ts', 'utf-8');
    // Match only actual import/from statements, not explanatory prose in comments.
    expect(src).not.toMatch(/from ['"][^'"]*(presented-map-push|map-service|map-layer-service|map-token-service)['"]/);
  });
});
