// @vitest-environment node
// M10-S17 (#363): Integrationstest — das host-seitige Kalender-Gate greift im
// echten Filter-Pfad. Ein Zukunfts-Event (start_day > Session-Jetzt) verlässt
// den Host NIE, selbst wenn es für den Spieler sichtbar freigegeben wäre.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { setSessionNow } from '../src/services/session-time-service';
import { filterEventsForPlayer } from '../src/services/player-content-filter-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

// Event für den Spieler sichtbar machen (session_visibility_overrides-Grant).
function grantVisible(db: DatabaseSync, campaignId: string, eventId: string, playerId: string) {
  db.prepare(
    `INSERT INTO session_visibility_overrides (id, campaign_id, target_type, target_id, scope, player_id, group_id)
     VALUES (?, ?, 'event', ?, 'player', ?, NULL)`,
  ).run(`ov-${eventId}`, campaignId, eventId, playerId);
}

describe('M10-S17 Calendar gate — host-side integration', () => {
  it('future event never leaves the host, even when visible', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const campaignId = 'camp-1';
      const playerId = 'p-1';
      await setSessionNow(asyncDb, { campaignId, day: 10 });

      const events = [
        { id: 'e-past', start_day: 5 },
        { id: 'e-now', start_day: 10 },
        { id: 'e-future', start_day: 20 },
      ];
      // ALLE drei sichtbar freigeben — nur die Zeit soll e-future ausschließen.
      for (const e of events) grantVisible(db, campaignId, e.id, playerId);

      const delivered = await filterEventsForPlayer({
        database: asyncDb,
        campaignId,
        context: { campaign_id: campaignId, player_id: playerId, group_ids: [] },
        events,
      });
      const ids = delivered.map((e) => e.id);
      expect(ids).toContain('e-past');
      expect(ids).toContain('e-now');
      expect(ids).not.toContain('e-future'); // Zeit-Gate: Zukunft nie ausgeliefert
    } finally {
      db.close();
    }
  });

  it('gm_only events are also excluded (visibility gate still applies)', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const campaignId = 'camp-1';
      const playerId = 'p-1';
      await setSessionNow(asyncDb, { campaignId, day: 100 });
      // e-secret liegt in der Vergangenheit (Zeit ok), ist aber NICHT freigegeben.
      const delivered = await filterEventsForPlayer({
        database: asyncDb,
        campaignId,
        context: { campaign_id: campaignId, player_id: playerId, group_ids: [] },
        events: [{ id: 'e-secret', start_day: 5 }],
      });
      expect(delivered).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});
