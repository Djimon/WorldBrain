// @vitest-environment node
// M14-S08: Effekt-Vokabel & Target-Modell (normativ)
// See: https://github.com/Djimon/WorldBrain/issues/263
//
// Note: pure resolver/parser module (no UI component or DatabaseLike
// consumer in this story's Unit-Tests bullet) — the generic AP-001
// "database prop typed as DatabaseLike" boilerplate does not map to a
// concrete artifact here; not tested to avoid fabricating a non-existent
// requirement (AGENTS.md: no extrapolation).

import { describe, expect, it } from 'vitest';

async function getEffectVocab() { return import('../src/services/effect-vocabulary'); }

describe('M14-S08 effect vocabulary & target model (normative)', () => {
  describe('parseTarget: world scope', () => {
    it('parses "world:siege" into { scope: "world", name: "siege" }', async () => {
      const { parseTarget } = await getEffectVocab();
      expect(parseTarget('world:siege')).toEqual({ scope: 'world', name: 'siege' });
    });
  });

  describe('parseTarget: entity scope with #status field', () => {
    it('parses "entity:npc_1#status" into { scope: "entity", id: "npc_1", field: "status" }', async () => {
      const { parseTarget } = await getEffectVocab();
      expect(parseTarget('entity:npc_1#status')).toEqual({ scope: 'entity', id: 'npc_1', field: 'status' });
    });
  });

  describe('parseTarget: reserved scopes rejected in V1', () => {
    it('"session:x" is rejected with a clear reserved-prefix message', async () => {
      const { parseTarget } = await getEffectVocab();
      expect(() => parseTarget('session:x')).toThrow(/reserved/i);
    });

    it('"char:x" is rejected with a clear reserved-prefix message', async () => {
      const { parseTarget } = await getEffectVocab();
      expect(() => parseTarget('char:x')).toThrow(/reserved/i);
    });
  });

  describe('parseTarget: unknown scope is an error', () => {
    it('an unrecognized scope prefix throws', async () => {
      const { parseTarget } = await getEffectVocab();
      expect(() => parseTarget('nonsense:x')).toThrow();
    });
  });

  describe('validateEffectVerb: invalid verb is an error, never a silent no-op', () => {
    it('a valid verb ("gain") does not throw', async () => {
      const { validateEffectVerb } = await getEffectVocab();
      expect(() => validateEffectVerb('gain')).not.toThrow();
    });

    it('an invalid verb throws', async () => {
      const { validateEffectVerb } = await getEffectVocab();
      expect(() => validateEffectVerb('teleport')).toThrow();
    });
  });

  describe('EffectVerb union is identical to M12-S07 (hook-engine.ts)', () => {
    it('EFFECT_VERBS matches the verb set hook-engine.ts\'s EffectDescriptor supports', async () => {
      const { EFFECT_VERBS } = await getEffectVocab();
      expect([...EFFECT_VERBS].sort()).toEqual(['clear', 'gain', 'set', 'set_flag', 'spend']);
    });
  });
});
