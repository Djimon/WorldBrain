// @vitest-environment node
// M10 / #424 (S5): Time-of-day as campaign/session state — realtime (24h/12h) +
// abstract (editable phases). Persisted per campaign, NOT in the calendar schema
// (CalendarDate stays {year,month,day}). Logic/service + persistence only; the
// view-independent display bar is S6 (#425). https://github.com/Djimon/WorldBrain/issues/424
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

async function svc() {
  return import('../src/services/session-time-of-day-service');
}

describe('M10-S5 (#424) time-of-day model', () => {
  describe('defaults', () => {
    it('a new campaign defaults to realtime / 24h and 5 phases', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        const state = await s.getTimeOfDay(asyncDb, 'camp-1');
        expect(state.mode).toBe('realtime');
        expect(state.clockFormat).toBe('24h');
        expect(state.phases).toHaveLength(5);
        expect(state.phaseIndex).toBe(0);
        expect(state.minuteOfDay).toBeGreaterThanOrEqual(0);
        expect(state.minuteOfDay).toBeLessThan(1440);
      } finally { db.close(); }
    });

    it('DEFAULT_PHASES has 5 entries (no German literals — i18n keys/identifiers)', async () => {
      const s = await svc();
      expect(s.DEFAULT_PHASES).toHaveLength(5);
      for (const p of s.DEFAULT_PHASES) {
        expect(p).not.toMatch(/[äöüÄÖÜß]/); // no German in the data-model default (AGENTS)
      }
    });
  });

  describe('persistence (campaign-scoped, survives reload)', () => {
    it('setTimeMode persists and is isolated per campaign', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        await s.setTimeMode(asyncDb, { campaignId: 'camp-1', mode: 'abstract' });
        expect((await s.getTimeOfDay(asyncDb, 'camp-1')).mode).toBe('abstract');
        // a different campaign is unaffected (still default realtime).
        expect((await s.getTimeOfDay(asyncDb, 'camp-2')).mode).toBe('realtime');
      } finally { db.close(); }
    });

    it('state survives a fresh read (persisted, not in-memory)', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        await s.setClockFormat(asyncDb, { campaignId: 'camp-1', clockFormat: '12h' });
        await s.setRealtimeMinute(asyncDb, { campaignId: 'camp-1', minuteOfDay: 615 });
        const reread = await s.getTimeOfDay(asyncDb, 'camp-1');
        expect(reread.clockFormat).toBe('12h');
        expect(reread.minuteOfDay).toBe(615);
      } finally { db.close(); }
    });
  });

  describe('realtime mode', () => {
    it('setRealtimeMinute sets an absolute minute; advanceRealtime wraps at 1440', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        await s.setRealtimeMinute(asyncDb, { campaignId: 'c', minuteOfDay: 1380 }); // 23:00
        await s.advanceRealtime(asyncDb, { campaignId: 'c', minutes: 120 });        // +2h → 01:00 next day
        expect((await s.getTimeOfDay(asyncDb, 'c')).minuteOfDay).toBe(60);
      } finally { db.close(); }
    });

    it('clock format toggles 24h ↔ 12h', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        await s.setClockFormat(asyncDb, { campaignId: 'c', clockFormat: '12h' });
        expect((await s.getTimeOfDay(asyncDb, 'c')).clockFormat).toBe('12h');
        await s.setClockFormat(asyncDb, { campaignId: 'c', clockFormat: '24h' });
        expect((await s.getTimeOfDay(asyncDb, 'c')).clockFormat).toBe('24h');
      } finally { db.close(); }
    });
  });

  describe('abstract mode — editable phases', () => {
    it('setPhases replaces the phase list (rename / add / remove)', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        await s.setPhases(asyncDb, { campaignId: 'c', phases: ['Dawn', 'Dusk', 'Deep Night'] });
        const state = await s.getTimeOfDay(asyncDb, 'c');
        expect(state.phases).toEqual(['Dawn', 'Dusk', 'Deep Night']);
      } finally { db.close(); }
    });

    it('setPhaseIndex selects a phase; advancePhase wraps around', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        await s.setPhases(asyncDb, { campaignId: 'c', phases: ['A', 'B', 'C'] });
        await s.setPhaseIndex(asyncDb, { campaignId: 'c', phaseIndex: 2 });
        expect((await s.getTimeOfDay(asyncDb, 'c')).phaseIndex).toBe(2);
        await s.advancePhase(asyncDb, { campaignId: 'c' }); // 2 → wraps to 0
        expect((await s.getTimeOfDay(asyncDb, 'c')).phaseIndex).toBe(0);
      } finally { db.close(); }
    });

    it('phaseIndex is clamped into range when the phase list shrinks', async () => {
      const { asyncDb, db } = createDatabase();
      try {
        const s = await svc();
        await s.setPhases(asyncDb, { campaignId: 'c', phases: ['A', 'B', 'C', 'D'] });
        await s.setPhaseIndex(asyncDb, { campaignId: 'c', phaseIndex: 3 });
        await s.setPhases(asyncDb, { campaignId: 'c', phases: ['A', 'B'] }); // removed 2 → index 3 invalid
        expect((await s.getTimeOfDay(asyncDb, 'c')).phaseIndex).toBeLessThan(2);
      } finally { db.close(); }
    });
  });

  describe('calendar schema untouched (architecture rule)', () => {
    it('CalendarDate stays {year, month, day} — no time-of-day fields', async () => {
      const src = readFileSync(new URL('../core_data/calendar-schema.ts', import.meta.url), 'utf8');
      // The CalendarDate shape must not gain hour/minute/time fields.
      const match = src.match(/interface CalendarDate\s*\{[^}]*\}/s);
      expect(match).not.toBeNull();
      expect(match![0]).not.toMatch(/hour|minute|timeOfDay|time_of_day/i);
    });
  });
});
