// @vitest-environment node
// M10-#386 / D18: host-authoritative Token-Sync. Ein SPIELER schickt einen
// Bewegungs-Intent; der Host autorisiert (Status-Lookup, kein Client-Vertrauen),
// schreibt die Ground Truth in die DB und broadcastet an alle. Ein gekickter
// Spieler bewegt nichts.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { createLoopbackTransport } from '../src/services/loopback-transport';
import { createPlayClientStore } from '../src/services/play-client-store';
import { attachClientStoreToTransport } from '../src/services/client-store-transport-bridge';
import { attachHostTokenSync, sendMoveIntent } from '../src/services/host-token-sync';
import { createToken, listTokens } from '../src/services/map-token-service';
import { applyMapSchema } from '../core_data/map-schema';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}
const schema = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

async function setup(playerStatus: 'active' | 'kicked') {
  const raw = new DatabaseSync(':memory:');
  raw.exec(schema);
  applyMapSchema(raw); // maps/map_layers/map_tokens liegen im Map-Schema
  const db = makeAsyncDb(raw);
  raw.prepare("INSERT INTO campaigns (id, title, created_at) VALUES ('c1','C','2026-01-01')").run();
  raw.prepare(
    `INSERT INTO session_players (id, campaign_id, player_id, token_hash, status, joined_at)
     VALUES ('sp1','c1','p-1','h', ?, '2026-01-01')`,
  ).run(playerStatus);
  raw.prepare("INSERT INTO maps (id, title, image_width_px, image_height_px) VALUES ('m1','M',100,100)").run();
  const { id: tokenId } = await createToken(db, { map_id: 'm1', x: 0, y: 0 });
  return { raw, db, tokenId };
}

describe('M10-#386 host-authoritative token sync', () => {
  it('player intent → host authorizes, persists ground truth, broadcasts to all', async () => {
    const { raw, db, tokenId } = await setup('active');
    try {
      const { clientSide, hostSide } = createLoopbackTransport();
      attachHostTokenSync({ transport: hostSide, database: db, campaignId: 'c1' });
      const store = createPlayClientStore({ playerId: 'p-1' });
      attachClientStoreToTransport(clientSide, store);

      // Spieler schickt Bewegungs-Intent über den Transport.
      sendMoveIntent(clientSide, { campaignId: 'c1', senderPlayerId: 'p-1', tokenId, x: 50, y: 60 });
      await new Promise<void>((r) => setTimeout(r, 10));

      // Ground truth in der Host-DB aktualisiert.
      const tokens = await listTokens(db, 'm1');
      const moved = tokens.find((t) => t.id === tokenId);
      expect(moved?.x).toBe(50);
      expect(moved?.y).toBe(60);
      // Broadcast beim Client angekommen.
      expect(store.get('token', tokenId)?.data).toEqual({ x: 50, y: 60 });
    } finally {
      raw.close();
    }
  });

  it('kicked player intent → no DB change, no broadcast', async () => {
    const { raw, db, tokenId } = await setup('kicked');
    try {
      const { clientSide, hostSide } = createLoopbackTransport();
      attachHostTokenSync({ transport: hostSide, database: db, campaignId: 'c1' });
      const store = createPlayClientStore({ playerId: 'p-1' });
      attachClientStoreToTransport(clientSide, store);

      sendMoveIntent(clientSide, { campaignId: 'c1', senderPlayerId: 'p-1', tokenId, x: 50, y: 60 });
      await new Promise<void>((r) => setTimeout(r, 10));

      const tokens = await listTokens(db, 'm1');
      expect(tokens.find((t) => t.id === tokenId)?.x).toBe(0); // unverändert
      expect(store.get('token', tokenId)).toBeNull(); // kein Broadcast
    } finally {
      raw.close();
    }
  });
});
