// @vitest-environment node
// M12-S08: Track-Felder (markierte Slot-Arrays)
// See: https://github.com/Djimon/WorldBrain/issues/233
//
// Note: pure resolver over session-state values passed by the caller (no new
// UI component in this story's Unit-Tests bullet) — the generic "database
// prop typed as DatabaseLike" boilerplate does not map to a concrete
// artifact here; not tested to avoid fabricating a non-existent requirement
// (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getTrackEngine() { return import('../src/services/track-engine'); }

const DAGGERHEART_HP_TRACK = {
  slots: '6',
  on_full: 'hp_track_full',
  on_last_mark: 'hp_track_last_mark',
};

const DEATH_SAVE_FAIL_TRACK = {
  slots: '3',
  on_full: 'dead',
};

describe('M12-S08 track fields (marked slot arrays)', () => {
  describe('resolveTrackSlots', () => {
    it('Daggerheart HP track resolves 6 slots', async () => {
      const { resolveTrackSlots } = await getTrackEngine();
      expect(resolveTrackSlots(DAGGERHEART_HP_TRACK, {})).toBe(6);
    });
  });

  describe('markTrack — Daggerheart HP-Track slots=6', () => {
    it('marking below the cap triggers no flags', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DAGGERHEART_HP_TRACK, 2, 1, {});
      expect(result.marked).toBe(3);
      expect(result.flags).toEqual([]);
    });

    it('marking the last available slot triggers on_full and on_last_mark', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DAGGERHEART_HP_TRACK, 5, 1, {});
      expect(result.marked).toBe(6);
      expect(result.flags).toContain('hp_track_full');
      expect(result.flags).toContain('hp_track_last_mark');
    });

    it('marking cannot exceed the resolved cap', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DAGGERHEART_HP_TRACK, 5, 3, {});
      expect(result.marked).toBe(6);
    });
  });

  describe('Death Saves as a 3-slot track', () => {
    it('3 failures marks the track full and triggers the "dead" flag', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DEATH_SAVE_FAIL_TRACK, 2, 1, {});
      expect(result.marked).toBe(3);
      expect(result.flags).toContain('dead');
    });

    it('2 failures does not trigger "dead"', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DEATH_SAVE_FAIL_TRACK, 1, 1, {});
      expect(result.flags).not.toContain('dead');
    });
  });

  describe('bug #250: on_last_mark must edge-trigger, not re-fire on an already-full track', () => {
    it('marking 5→6 (crossing the cap) fires on_last_mark', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DAGGERHEART_HP_TRACK, 5, 1, {});
      expect(result.marked).toBe(6);
      expect(result.flags).toContain('hp_track_last_mark');
    });

    it('marking an already-full track (6→6) does not re-fire on_last_mark', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DAGGERHEART_HP_TRACK, 6, 1, {});
      expect(result.marked).toBe(6);
      expect(result.flags).not.toContain('hp_track_last_mark');
    });

    it('on_full still fires on an already-full track (level-triggered)', async () => {
      const { markTrack } = await getTrackEngine();
      const result = markTrack(DAGGERHEART_HP_TRACK, 6, 1, {});
      expect(result.flags).toContain('hp_track_full');
    });
  });

  describe('clearTrack', () => {
    it('clears marks down to a minimum of 0', async () => {
      const { clearTrack } = await getTrackEngine();
      expect(clearTrack(6, 6)).toBe(0);
    });

    it('clearing more than marked does not go negative', async () => {
      const { clearTrack } = await getTrackEngine();
      expect(clearTrack(2, 5)).toBe(0);
    });
  });

  describe('error handling: unresolvable slots formula → null, not a crash', () => {
    it('resolveTrackSlots returns null for an unresolvable formula', async () => {
      const { resolveTrackSlots } = await getTrackEngine();
      const badDescriptor = { slots: 'nonexistent_field' };
      expect(() => resolveTrackSlots(badDescriptor, {})).not.toThrow();
      expect(resolveTrackSlots(badDescriptor, {})).toBeNull();
    });
  });

  describe('no eval()', () => {
    it('track-engine.ts does not use eval()', () => {
      const src = readFileSync('src/services/track-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
