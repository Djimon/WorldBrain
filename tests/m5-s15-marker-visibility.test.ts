// @vitest-environment node
// E8-S07: Marker visibility & condition gates — same 4 scopes as entity blocks.
// See: https://github.com/Djimon/WorldBrain/issues/81

import { describe, expect, it } from 'vitest';

async function getMarkerVisibility() { return import('../src/services/map-marker-visibility'); }

const gmCtx = { role: 'gm' as const, knownEntities: [], sessionVars: {}, globalVars: {} };
const playerCtx = { role: 'player' as const, knownEntities: ['char-ada'], sessionVars: {}, globalVars: {} };

describe('E8-S07 marker visibility', () => {
  describe('resolveMarkerVisibility export', () => {
    it('exports resolveMarkerVisibility function', async () => {
      const mod = await getMarkerVisibility();
      expect(typeof mod.resolveMarkerVisibility).toBe('function');
    });
  });

  describe('public scope', () => {
    it('public marker → visible for GM', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({ visibility: 'public' }, gmCtx);
      expect(result).toBe('visible');
    });

    it('public marker → visible for player', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({ visibility: 'public' }, playerCtx);
      expect(result).toBe('visible');
    });
  });

  describe('gm_only scope', () => {
    it('gm_only marker → gm_only for GM', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({ visibility: 'gm_only' }, gmCtx);
      expect(result).toBe('gm_only');
    });

    it('gm_only marker → hidden for player', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({ visibility: 'gm_only' }, playerCtx);
      expect(result).toBe('hidden');
    });
  });

  describe('player_known scope', () => {
    it('player_known marker → visible when entity in knownEntities', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({ visibility: 'player_known', entity_id: 'char-ada' }, playerCtx);
      expect(result).toBe('visible');
    });

    it('player_known marker → hidden when entity not in knownEntities', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({ visibility: 'player_known', entity_id: 'char-unknown' }, playerCtx);
      expect(result).toBe('hidden');
    });

    it('player_known marker → visible for GM regardless', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({ visibility: 'player_known', entity_id: 'char-unknown' }, gmCtx);
      expect(result).toBe('visible');
    });
  });

  describe('hidden_until_condition scope', () => {
    it('hidden_until_condition → visible for GM', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const result = resolveMarkerVisibility({
        visibility: 'hidden_until_condition',
        condition: { '==': [{ var: 'vars.revealed' }, true] },
      }, gmCtx);
      expect(result).toBe('visible');
    });

    it('hidden_until_condition evaluates JsonLogic — true condition → visible for player', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const ctx = { ...playerCtx, sessionVars: { revealed: true } };
      const result = resolveMarkerVisibility({
        visibility: 'hidden_until_condition',
        condition: { '==': [{ var: 'vars.revealed' }, true] },
      }, ctx);
      expect(result).toBe('visible');
    });

    it('hidden_until_condition evaluates JsonLogic — false condition → hidden for player', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const ctx = { ...playerCtx, sessionVars: { revealed: false } };
      const result = resolveMarkerVisibility({
        visibility: 'hidden_until_condition',
        condition: { '==': [{ var: 'vars.revealed' }, true] },
      }, ctx);
      expect(result).toBe('hidden');
    });
  });

  describe('filterMarkersForContext', () => {
    it('exports filterMarkersForContext function', async () => {
      const mod = await getMarkerVisibility();
      expect(typeof mod.filterMarkersForContext).toBe('function');
    });

    it('filterMarkersForContext returns only visible/gm_only markers for GM', async () => {
      const { filterMarkersForContext } = await getMarkerVisibility();
      const markers = [
        { id: 'mk1', visibility: 'public' },
        { id: 'mk2', visibility: 'gm_only' },
        { id: 'mk3', visibility: 'player_known', entity_id: 'char-unknown' },
      ];
      const result = filterMarkersForContext(markers, gmCtx);
      expect(result.map((m: { id: string }) => m.id)).toContain('mk1');
      expect(result.map((m: { id: string }) => m.id)).toContain('mk2');
    });

    it('filterMarkersForContext hides gm_only markers from player', async () => {
      const { filterMarkersForContext } = await getMarkerVisibility();
      const markers = [
        { id: 'mk1', visibility: 'public' },
        { id: 'mk2', visibility: 'gm_only' },
      ];
      const result = filterMarkersForContext(markers, playerCtx);
      expect(result.map((m: { id: string }) => m.id)).toContain('mk1');
      expect(result.map((m: { id: string }) => m.id)).not.toContain('mk2');
    });
  });

  // #112: globalVars missing from hidden_until_condition evaluation
  describe('globalVars in condition context (#112)', () => {
    it('globalVars are merged into condition data — global var condition resolves to visible', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const ctx = { ...playerCtx, sessionVars: {}, globalVars: { market_days: 5 } };
      const result = resolveMarkerVisibility({
        visibility: 'hidden_until_condition',
        condition: { '==': [{ var: 'market_days' }, 5] },
      }, ctx);
      expect(result).toBe('visible');
    });

    it('global var not matching → hidden for player', async () => {
      const { resolveMarkerVisibility } = await getMarkerVisibility();
      const ctx = { ...playerCtx, sessionVars: {}, globalVars: { market_days: 3 } };
      const result = resolveMarkerVisibility({
        visibility: 'hidden_until_condition',
        condition: { '==': [{ var: 'market_days' }, 5] },
      }, ctx);
      expect(result).toBe('hidden');
    });

    it('source spreads globalVars into condition data', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/services/map-marker-visibility.ts', 'utf8');
      expect(src).toMatch(/globalVars/);
    });
  });
});
