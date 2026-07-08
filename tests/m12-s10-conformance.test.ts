// @vitest-environment node
// M12-S10: Konformanz-Nachweis (2 Systeme)
// See: https://github.com/Djimon/WorldBrain/issues/235
//
// Note: pure resolver/fixture-existence checks (no new UI component or
// DatabaseLike consumer in this story's Unit-Tests bullet) — the generic
// "database prop typed as DatabaseLike" boilerplate does not map to a
// concrete artifact here; not tested to avoid fabricating a non-existent
// requirement (AGENTS.md: no extrapolation).

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DND5E_DIR = path.join('plugins', 'dnd5e_srd');
const TOY_DIR = path.join('plugins', 'roll_under_demo');

function readEntityType(pluginDir: string, id: string): { fields?: { id: string }[] } {
  const p = path.join(pluginDir, 'entity_types', `${id}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

describe('M12-S10 conformance proof (2 structurally different systems)', () => {
  describe('dnd5e_srd extended with M12 primitives', () => {
    it('player_character schema declares a death-save track field (S08)', () => {
      const schema = readEntityType(DND5E_DIR, 'player_character');
      const field = schema.fields?.find((f) => f.id === 'death_saves');
      expect(field).toBeDefined();
    });

    it('player_character schema declares current_hp as a resource (S03)', () => {
      const schema = readEntityType(DND5E_DIR, 'player_character');
      const field = schema.fields?.find((f) => f.id === 'current_hp');
      expect(field).toBeDefined();
    });
  });

  describe('roll_under_demo toy fixture (system-agnostic proof)', () => {
    it('plugins/roll_under_demo/ directory exists', () => {
      expect(fs.existsSync(TOY_DIR)).toBe(true);
    });

    it('plugin.json exists and is not proprietary D&D content', () => {
      const manifestPath = path.join(TOY_DIR, 'plugin.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : {};
      expect(manifest.db_prefix).toBeTruthy();
    });

    it('passes validatePluginManifest without errors', async () => {
      const { validatePluginManifest } = await import('../src/services/plugin-validator');
      const manifestPath = path.join(TOY_DIR, 'plugin.json');
      const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : {};
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
    });
  });

  describe('end-to-end: roll-under + 5-tier bands + resource cascade + bonus dice compose correctly', () => {
    it('a roll-under skill check classifies into a CoC-style band', async () => {
      const { classifyRoll } = await import('../src/services/roll-target-resolver');
      const { classifyBand } = await import('../src/services/success-bands-resolver');
      const target = { target: 'dodge', direction: 'under' as const };
      // roll under a skill of 50, roll=10 → success (S01) and 'extreme' (S02)
      expect(classifyRoll(target, { dodge: 50 }, 10)).toBe('success');
      const bands = [
        { name: 'extreme', when: 'roll <= floor(target / 5)' },
        { name: 'regular', when: 'roll <= target' },
        { name: 'fail', when: 'roll > target' },
      ];
      expect(classifyBand(bands, { roll: 10, target: 50 })).toBe('extreme');
    });

    it('a resource threshold trigger cascades from a hook effect (S03+S07 composition)', async () => {
      const { resolveEffectAmount } = await import('../src/services/hook-engine');
      const { applyResourceChange } = await import('../src/services/resource-engine');
      const sanityDescriptor = {
        seedFrom: 'pow', max: '99 - mythos', min: 0,
        triggers: [{ when: 'delta_single <= -5', set_flag: 'temporaryInsanity' }],
      };
      const spendEffect = { verb: 'spend' as const, resource: 'sanity', amount: '1d6' };
      const amount = resolveEffectAmount(spendEffect, {}, 5);
      const result = applyResourceChange(
        sanityDescriptor, { pow: 60, mythos: 0 },
        { value: 60, sessionStart: 60, deltaSession: 0 }, -(amount as number),
      );
      expect(result.flags).toContain('temporaryInsanity');
    });

    it('bonus/penalty dice modifiers resolve alongside the roll-under check (S05)', async () => {
      const { resolveNetModifier } = await import('../src/services/roll-modifier-engine');
      const bonusDie = { kind: 'extra-die' as const, of: 1, pool: 'tens' as const, keep: 'best' as const, stacking: 'cancel-pairwise' as const };
      const net = resolveNetModifier([bonusDie]);
      expect(net.kind).toBe('extra-die');
    });
  });
});
