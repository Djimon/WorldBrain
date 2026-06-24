// @vitest-environment node
// M4-S05: Visibility system — resolveVisibility() for all 4 scopes.
// See: https://github.com/Djimon/WorldBrain/issues/53

import { describe, expect, it } from 'vitest';

async function getVisibilityService() {
  return import('../src/services/visibility-service');
}

const baseContext = {
  audience: 'gm' as const,
  vars: { isNight: true, hp: 10 },
  globals: {},
  flags: {},
  knownEntities: new Set<string>(),
};

const playerContext = {
  ...baseContext,
  audience: 'player' as const,
};

describe('M4-S05 visibility system', () => {
  describe('resolveVisibility export', () => {
    it('exports resolveVisibility function', async () => {
      const mod = await getVisibilityService();
      expect(typeof mod.resolveVisibility).toBe('function');
    });

    it('returns "visible", "hidden", or "gm_only"', async () => {
      const { resolveVisibility } = await getVisibilityService();
      const result = resolveVisibility({ visibility: 'public' }, baseContext);
      expect(['visible', 'hidden', 'gm_only']).toContain(result);
    });
  });

  describe('public scope', () => {
    it('public items are visible to GM', async () => {
      const { resolveVisibility } = await getVisibilityService();
      expect(resolveVisibility({ visibility: 'public' }, baseContext)).toBe('visible');
    });

    it('public items are visible to players', async () => {
      const { resolveVisibility } = await getVisibilityService();
      expect(resolveVisibility({ visibility: 'public' }, playerContext)).toBe('visible');
    });
  });

  describe('gm_only scope', () => {
    it('gm_only items are visible to GM', async () => {
      const { resolveVisibility } = await getVisibilityService();
      expect(resolveVisibility({ visibility: 'gm_only' }, baseContext)).toBe('gm_only');
    });

    it('gm_only items are hidden from players', async () => {
      const { resolveVisibility } = await getVisibilityService();
      expect(resolveVisibility({ visibility: 'gm_only' }, playerContext)).toBe('hidden');
    });
  });

  describe('player_known scope', () => {
    it('player_known items are visible when entity is in knownEntities', async () => {
      const { resolveVisibility } = await getVisibilityService();
      const ctx = { ...playerContext, knownEntities: new Set(['entity-ada']) };
      expect(resolveVisibility({ visibility: 'player_known', entityId: 'entity-ada' }, ctx)).toBe('visible');
    });

    it('player_known items are hidden when entity is not in knownEntities', async () => {
      const { resolveVisibility } = await getVisibilityService();
      expect(resolveVisibility({ visibility: 'player_known', entityId: 'entity-unknown' }, playerContext)).toBe('hidden');
    });

    it('player_known items are always visible to GM', async () => {
      const { resolveVisibility } = await getVisibilityService();
      expect(resolveVisibility({ visibility: 'player_known', entityId: 'entity-ada' }, baseContext)).toBe('visible');
    });
  });

  describe('hidden_until_condition scope', () => {
    it('hidden_until_condition is visible when condition evaluates true', async () => {
      const { resolveVisibility } = await getVisibilityService();
      const ctx = { ...playerContext, vars: { isNight: true }, globals: {}, flags: {} };
      const item = {
        visibility: 'hidden_until_condition' as const,
        condition: { '==': [{ var: 'vars.isNight' }, true] },
      };
      expect(resolveVisibility(item, ctx)).toBe('visible');
    });

    it('hidden_until_condition is hidden when condition evaluates false', async () => {
      const { resolveVisibility } = await getVisibilityService();
      const ctx = { ...playerContext, vars: { isNight: false }, globals: {}, flags: {} };
      const item = {
        visibility: 'hidden_until_condition' as const,
        condition: { '==': [{ var: 'vars.isNight' }, true] },
      };
      expect(resolveVisibility(item, ctx)).toBe('hidden');
    });

    it('GM always sees hidden_until_condition blocks regardless of condition', async () => {
      const { resolveVisibility } = await getVisibilityService();
      const ctx = { ...baseContext, vars: { isNight: false }, globals: {}, flags: {} };
      const item = {
        visibility: 'hidden_until_condition' as const,
        condition: { '==': [{ var: 'vars.isNight' }, true] },
      };
      // GM sees it — after #120 fix may also return 'gm_conditional' (unmet condition badge)
      const result = resolveVisibility(item, ctx);
      expect(['visible', 'gm_only', 'gm_conditional']).toContain(result);
    });
  });
});

// Bug #120: GM viewing hidden_until_condition with unmet condition must get 'gm_conditional',
//           not the same value as a player, so GM UI can show 'currently hidden from players' badge.
describe('issue #120: resolveVisibility gm_conditional for unmet hidden_until_condition', () => {
  it('returns "gm_conditional" when GM views an unmet hidden_until_condition item', async () => {
    const { resolveVisibility } = await getVisibilityService();
    const gmCtx = { ...baseContext, audience: 'gm' as const, vars: { isNight: false }, globals: {}, flags: {} };
    const item = {
      visibility: 'hidden_until_condition' as const,
      condition: { '==': [{ var: 'vars.isNight' }, true] },
    };
    expect(resolveVisibility(item, gmCtx)).toBe('gm_conditional');
  });

  it('does not return "hidden" when GM views an unmet hidden_until_condition item', async () => {
    const { resolveVisibility } = await getVisibilityService();
    const gmCtx = { ...baseContext, audience: 'gm' as const, vars: { isNight: false }, globals: {}, flags: {} };
    const item = {
      visibility: 'hidden_until_condition' as const,
      condition: { '==': [{ var: 'vars.isNight' }, true] },
    };
    expect(resolveVisibility(item, gmCtx)).not.toBe('hidden');
  });

  it('still returns "hidden" when player views an unmet hidden_until_condition item', async () => {
    const { resolveVisibility } = await getVisibilityService();
    const pCtx = { ...playerContext, vars: { isNight: false }, globals: {}, flags: {} };
    const item = {
      visibility: 'hidden_until_condition' as const,
      condition: { '==': [{ var: 'vars.isNight' }, true] },
    };
    expect(resolveVisibility(item, pCtx)).toBe('hidden');
  });

  it('does not return "gm_conditional" when condition IS met for GM', async () => {
    const { resolveVisibility } = await getVisibilityService();
    const gmCtx = { ...baseContext, audience: 'gm' as const, vars: { isNight: true }, globals: {}, flags: {} };
    const item = {
      visibility: 'hidden_until_condition' as const,
      condition: { '==': [{ var: 'vars.isNight' }, true] },
    };
    expect(resolveVisibility(item, gmCtx)).not.toBe('gm_conditional');
  });
});
