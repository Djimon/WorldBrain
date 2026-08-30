// @vitest-environment node
// M10-#386: der Host SENDET die präsentierte Karte (Snapshot) wirklich — vorher
// existierte computeSnapshot, wurde aber nie über den Transport verschickt.
// Loopback: Host pusht → DB-loser Client-Store bekommt Karte + Tokens.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { applyMapSchema } from '../core_data/map-schema';
import { createToken } from '../src/services/map-token-service';
import { createLayer } from '../src/services/map-layer-service';
import { createLoopbackTransport } from '../src/services/loopback-transport';
import { createPlayClientStore } from '../src/services/play-client-store';
import { attachClientStoreToTransport } from '../src/services/client-store-transport-bridge';
import { pushPresentedMapSnapshot } from '../src/services/presented-map-push';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}
const schema = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

describe('M10-#386 presented-map snapshot push', () => {
  it('host push populates the DB-less client store with map + tokens', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(schema);
    applyMapSchema(raw);
    const db = makeAsyncDb(raw);

    // Präsentierte Karte m1 (mit Image-Layer) + zwei Tokens, an der Campaign gesetzt.
    raw.prepare("INSERT INTO maps (id, title, image_width_px, image_height_px) VALUES ('m1','Taverne',100,100)").run();
    await createLayer(db, { map_id: 'm1', layer_type: 'image', asset_id: 'img-1' });
    await createToken(db, { map_id: 'm1', x: 5, y: 5, session_id: 'c1' });
    await createToken(db, { map_id: 'm1', x: 9, y: 9, session_id: 'c1' });
    raw.prepare("INSERT INTO campaigns (id, title, active_map_id, created_at) VALUES ('c1','C','m1','2026-01-01')").run();

    const { clientSide, hostSide } = createLoopbackTransport();
    const store = createPlayClientStore({ playerId: 'p-1' });
    attachClientStoreToTransport(clientSide, store);

    await pushPresentedMapSnapshot({ database: db, campaignId: 'c1', transport: hostSide });
    await new Promise<void>((r) => setTimeout(r, 10));

    // Karte im Store (mit Bild-URL).
    const maps = store.list('map');
    expect(maps).toHaveLength(1);
    expect(maps[0].id).toBe('m1');
    expect(String(maps[0].data.image_url)).toContain('img-1');
    // Beide Tokens im Store.
    expect(store.list('token')).toHaveLength(2);

    raw.close();
  });

  it('no presented map → empty snapshot (player sees no scene)', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(schema);
    applyMapSchema(raw);
    const db = makeAsyncDb(raw);
    raw.prepare("INSERT INTO campaigns (id, title, active_map_id, created_at) VALUES ('c1','C',NULL,'2026-01-01')").run();

    const { clientSide, hostSide } = createLoopbackTransport();
    const store = createPlayClientStore({ playerId: 'p-1' });
    attachClientStoreToTransport(clientSide, store);

    await pushPresentedMapSnapshot({ database: db, campaignId: 'c1', transport: hostSide });
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(store.list('map')).toHaveLength(0);
    raw.close();
  });
});
