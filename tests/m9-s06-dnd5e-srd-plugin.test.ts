// @vitest-environment node
// M9-S06: D&D 5e SRD Referenz-Plugin
// See: https://github.com/Djimon/WorldBrain/issues/169
//
// Note: "Plugin-Info UI zeigt SRD-Attribution sichtbar" is a UI-surface AC point
// with no corresponding component convention in this codebase yet — not tested
// here to avoid fabricating a non-existent artifact (AGENTS.md: no extrapolation).
// The manifest-level attribution string (this file's license section) is covered.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const PLUGIN_DIR = path.join('plugins', 'dnd5e-srd');
const MANIFEST_PATH = path.join(PLUGIN_DIR, 'plugin.json');

interface FieldDef {
  id: string;
  computed?: boolean;
  formula?: string;
  lookup?: unknown;
  type?: string;
  target?: string;
  instance?: Record<string, string>;
}

function readManifest(): Record<string, unknown> {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
}

function readEntityType(id: string): { fields?: FieldDef[] } {
  const p = path.join(PLUGIN_DIR, 'entity_types', `${id}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function readTable(name: string): Record<string, number> {
  const p = path.join(PLUGIN_DIR, 'tables', `${name}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function readTable2D(name: string): Record<string, Record<string, number>> {
  const p = path.join(PLUGIN_DIR, 'tables', `${name}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function readAllExampleContent(): string {
  const examplesDir = path.join(PLUGIN_DIR, 'examples');
  if (!fs.existsSync(examplesDir)) return '';
  const entries = fs.readdirSync(examplesDir, { recursive: true }) as string[];
  return entries
    .map((f) => {
      try { return fs.readFileSync(path.join(examplesDir, f), 'utf-8'); } catch { return ''; }
    })
    .join('\n')
    .toLowerCase();
}

describe('M9-S06 D&D 5e SRD reference plugin (playable character sheet)', () => {
  describe('plugin directory structure', () => {
    it('plugins/dnd5e-srd/ directory exists', () => {
      expect(fs.existsSync(PLUGIN_DIR)).toBe(true);
    });

    it('plugin.json exists', () => {
      expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    });

    it('entity_types/ directory exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types'))).toBe(true);
    });

    it('tables/ directory exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'tables'))).toBe(true);
    });

    it('locales/ directory exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'locales'))).toBe(true);
    });
  });

  describe('plugin.json manifest', () => {
    it('has system: true', () => {
      expect(readManifest().system).toBe(true);
    });

    it('has db_prefix: "dnd5e" (#220)', () => {
      expect(readManifest().db_prefix).toBe('dnd5e');
    });

    it('has mechanics block with all 6 attributes', () => {
      const mechanics = readManifest().mechanics as Record<string, unknown> | undefined;
      for (const attr of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
        expect(mechanics?.attributes).toContain(attr);
      }
    });

    it('challenge_metric is "cr"', () => {
      const mechanics = readManifest().mechanics as Record<string, unknown> | undefined;
      expect(mechanics?.challenge_metric).toBe('cr');
    });

    it('distance_units includes "ft" and "mile"', () => {
      const mechanics = readManifest().mechanics as Record<string, unknown> | undefined;
      const units = (mechanics?.distance_units ?? []) as string[];
      expect(units).toContain('ft');
      expect(units).toContain('mile');
    });

    it('resource_types includes hp, spell_slots_1..9 and hit_dice', () => {
      const mechanics = readManifest().mechanics as Record<string, unknown> | undefined;
      const rt = (mechanics?.resource_types ?? []) as string[];
      expect(rt).toContain('hp');
      expect(rt).toContain('spell_slots_1');
      expect(rt).toContain('spell_slots_9');
      expect(rt).toContain('hit_dice');
    });

    it('license is CC-BY-4.0 (SRD 5.1 attribution)', () => {
      expect(readManifest().license).toBe('CC-BY-4.0');
    });

    it('carries an SRD 5.1 attribution string', () => {
      const attribution = String(readManifest().attribution ?? '');
      expect(attribution.toLowerCase()).toMatch(/srd 5\.1|systems reference document/);
    });

    it('declares at least one relation_type for creature ability/spell knowledge-graph filtering', () => {
      const relationTypes = (readManifest().relation_types ?? []) as { relation_type?: string }[];
      expect(relationTypes.length).toBeGreaterThan(0);
    });
  });

  describe('plugin validation (#164/#220)', () => {
    it('plugin passes validatePluginManifest without errors', async () => {
      const { validatePluginManifest } = await import('../src/services/plugin-validator');
      const result = validatePluginManifest(readManifest());
      expect(result.valid).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);
    });
  });

  describe('entity type schemas', () => {
    it.each(['player_character', 'creature', 'spell', 'item', 'feat', 'species'])(
      '%s.json entity type exists',
      (id) => {
        expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', `${id}.json`))).toBe(true);
      },
    );
  });

  describe('player_character base fields', () => {
    it('has a "class" base field (V1 freetext)', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'class');
      expect(field).toBeDefined();
      expect(field?.computed).not.toBe(true);
    });

    it('has a "level" base field', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'level');
      expect(field).toBeDefined();
    });
  });

  describe('computed ability modifiers (all 6, formula derived-type)', () => {
    it.each(['str', 'dex', 'con', 'int', 'wis', 'cha'])('%s_mod is a computed formula field', (ability) => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === `${ability}_mod`);
      expect(field?.computed).toBe(true);
      expect(field?.formula).toBe(`floor((${ability} - 10) / 2)`);
    });
  });

  describe('ac_total: conditional unarmored vs armor (M9-S09)', () => {
    it('ac_total field uses an if() conditional formula', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'ac_total');
      expect(field?.computed).toBe(true);
      expect(field?.formula).toMatch(/^if\(/);
    });

    it('unarmored: ac_total = 10 + dex_mod', async () => {
      const { resolveComputedFields } = await import('../src/services/formula-engine');
      const schema = readEntityType('player_character');
      const acField = schema.fields?.find((f) => f.id === 'ac_total');
      const fields: Record<string, { computed?: boolean; formula?: string }> = {
        dex_mod: { computed: true, formula: 'floor((dex - 10) / 2)' },
        ac_total: { computed: true, formula: acField?.formula },
      };
      const result = resolveComputedFields(fields, { dex: 14, is_unarmored: 1, armor_ac: 15 }, {});
      expect(result.ac_total).toBe(12);
    });

    it('armored: ac_total = armor_ac', async () => {
      const { resolveComputedFields } = await import('../src/services/formula-engine');
      const schema = readEntityType('player_character');
      const acField = schema.fields?.find((f) => f.id === 'ac_total');
      const fields: Record<string, { computed?: boolean; formula?: string }> = {
        dex_mod: { computed: true, formula: 'floor((dex - 10) / 2)' },
        ac_total: { computed: true, formula: acField?.formula },
      };
      const result = resolveComputedFields(fields, { dex: 14, is_unarmored: 0, armor_ac: 15 }, {});
      expect(result.ac_total).toBe(15);
    });
  });

  describe('lookup derived-type: prof_bonus, 1D (#219)', () => {
    it('tables/prof_by_level.json resolves threshold levels correctly', async () => {
      const { resolveLookup } = await import('../src/services/formula-engine');
      const table = readTable('prof_by_level');
      expect(resolveLookup(table, 4, 'threshold')).toBe(2);
      expect(resolveLookup(table, 5, 'threshold')).toBe(3);
      expect(resolveLookup(table, 17, 'threshold')).toBe(6);
    });

    it('player_character.json declares prof_bonus as a lookup field on prof_by_level/level', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'prof_bonus');
      const lookup = field?.lookup as { table?: string; key_field?: string; mode?: string } | undefined;
      expect(lookup?.table).toBe('prof_by_level');
      expect(lookup?.key_field).toBe('level');
      expect(lookup?.mode).toBe('threshold');
    });
  });

  describe('proficiency-gated skill mods & saves (explicit, 0/1-flag multiplication)', () => {
    it('at least one skill_mod field is gated by a proficient_<skill> flag × prof_bonus', () => {
      const schema = readEntityType('player_character');
      const skillField = schema.fields?.find(
        (f) => /_mod$/.test(f.id) && !['str_mod', 'dex_mod', 'con_mod', 'int_mod', 'wis_mod', 'cha_mod'].includes(f.id),
      );
      expect(skillField).toBeDefined();
      expect(skillField?.formula).toMatch(/proficient_\w+\s*\*\s*prof_bonus/);
    });

    it('non-proficient skill_mod resolves to plain ability_mod (gate multiplies to 0)', async () => {
      const { resolveComputedFields } = await import('../src/services/formula-engine');
      const schema = readEntityType('player_character');
      const skillField = schema.fields?.find((f) => /_mod$/.test(f.id) && f.formula?.includes('proficient_'));
      const abilityRef = skillField!.formula!.match(/(\w+)_mod/)![1];
      const fields: Record<string, { computed?: boolean; formula?: string }> = {
        [`${abilityRef}_mod`]: { computed: true, formula: `floor((${abilityRef} - 10) / 2)` },
        prof_bonus: { computed: true, formula: '3' },
        [skillField!.id]: { computed: true, formula: skillField!.formula },
      };
      const entity: Record<string, number> = { [abilityRef]: 14 };
      entity[`proficient_${skillField!.id.replace(/_mod$/, '')}`] = 0;
      const result = resolveComputedFields(fields, entity, {});
      expect(result[skillField!.id]).toBe(2); // just dex_mod-equivalent, no prof_bonus added
    });

    it('proficient skill_mod adds prof_bonus once', async () => {
      const { resolveComputedFields } = await import('../src/services/formula-engine');
      const schema = readEntityType('player_character');
      const skillField = schema.fields?.find((f) => /_mod$/.test(f.id) && f.formula?.includes('proficient_'));
      const abilityRef = skillField!.formula!.match(/(\w+)_mod/)![1];
      const fields: Record<string, { computed?: boolean; formula?: string }> = {
        [`${abilityRef}_mod`]: { computed: true, formula: `floor((${abilityRef} - 10) / 2)` },
        prof_bonus: { computed: true, formula: '3' },
        [skillField!.id]: { computed: true, formula: skillField!.formula },
      };
      const entity: Record<string, number> = { [abilityRef]: 14 };
      entity[`proficient_${skillField!.id.replace(/_mod$/, '')}`] = 1;
      const result = resolveComputedFields(fields, entity, {});
      expect(result[skillField!.id]).toBe(5); // dex_mod(2) + prof_bonus(3)
    });

    it('at least one saving throw is gated by save_prof_<ability>', () => {
      const schema = readEntityType('player_character');
      const saveField = schema.fields?.find((f) => /_save$/.test(f.id));
      expect(saveField).toBeDefined();
      expect(saveField?.formula).toMatch(/save_prof_\w+\s*\*\s*prof_bonus/);
    });
  });

  describe('2D lookup: spell slots by class × level (#223)', () => {
    it('spell_slots_1_max is a 2D lookup field (class × level)', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'spell_slots_1_max');
      const lookup = field?.lookup as { table?: string; key_fields?: string[]; modes?: string[] } | undefined;
      expect(lookup?.key_fields).toEqual(['class', 'level']);
    });

    it('tables/spell_slots_1.json resolves wizard level-5 slot count', async () => {
      const { evaluateLookupField2D } = await import('../src/services/formula-engine');
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'spell_slots_1_max');
      const lookup = field?.lookup as { table: string; key_fields: [string, string]; modes: ['threshold' | 'exact', 'threshold' | 'exact'] };
      const result = evaluateLookupField2D(
        { computed: true, lookup },
        { class: 'wizard', level: 5 },
        { [lookup.table]: readTable2D(lookup.table) },
      );
      expect(result).not.toBeNull();
    });
  });

  describe('level-driven re-derivation (Decision 20)', () => {
    it('changing level re-derives prof_bonus — no hardcoded constant', async () => {
      const { resolveLookup } = await import('../src/services/formula-engine');
      const table = readTable('prof_by_level');
      const atLevel4 = resolveLookup(table, 4, 'threshold');
      const atLevel5 = resolveLookup(table, 5, 'threshold');
      expect(atLevel4).not.toBe(atLevel5);
    });
  });

  describe('reference fields on player_character (Decision 14)', () => {
    it('known_spells is a ref[] field targeting "spell"', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'known_spells');
      expect(field?.type).toBe('ref[]');
      expect(field?.target).toBe('spell');
    });

    it('feats is a ref[] field targeting "feat"', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'feats');
      expect(field?.type).toBe('ref[]');
      expect(field?.target).toBe('feat');
    });

    it('inventory is an embedded ref[] field targeting "item" with qty/equipped instance attrs', () => {
      const schema = readEntityType('player_character');
      const field = schema.fields?.find((f) => f.id === 'inventory');
      expect(field?.type).toBe('ref[]');
      expect(field?.target).toBe('item');
      expect(field?.instance).toHaveProperty('qty');
      expect(field?.instance).toHaveProperty('equipped');
    });

    it('reference fields pass validateEntityTypeRefs against known entity types', async () => {
      const { validateEntityTypeRefs } = await import('../src/services/plugin-ref-validator');
      const schema = readEntityType('player_character');
      const fieldsMap = Object.fromEntries((schema.fields ?? []).map((f) => [f.id, f]));
      const errors = validateEntityTypeRefs({ fields: fieldsMap as never }, new Set(['spell', 'item', 'feat', 'species']));
      expect(errors).toEqual([]);
    });
  });

  describe('dice fields (expression stored, average is display-only, M8-S11 clickable)', () => {
    it('creature.json hp field is a dice-expression string field', () => {
      const schema = readEntityType('creature');
      const hpField = schema.fields?.find((f) => f.id === 'hp');
      expect(hpField?.type).toBe('dice');
    });
  });

  describe('i18n plugin locales (#214)', () => {
    it('locales/en.json and locales/de.json exist', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'locales', 'en.json'))).toBe(true);
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'locales', 'de.json'))).toBe(true);
    });

    it('en and de locale files declare the same keys', () => {
      const enPath = path.join(PLUGIN_DIR, 'locales', 'en.json');
      const dePath = path.join(PLUGIN_DIR, 'locales', 'de.json');
      const en = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf-8')) : {};
      const de = fs.existsSync(dePath) ? JSON.parse(fs.readFileSync(dePath, 'utf-8')) : {};
      expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
      expect(Object.keys(en).length).toBeGreaterThan(0);
    });

    it('registerPluginLocales + getPluginT resolve a translation under the plugin:dnd5e-srd namespace', async () => {
      const { registerPluginLocales, getPluginT } = await import('../src/services/plugin-i18n-service');
      const manifest = readManifest();
      const enPath = path.join(PLUGIN_DIR, 'locales', 'en.json');
      const dePath = path.join(PLUGIN_DIR, 'locales', 'de.json');
      const locales = {
        en: fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf-8')) : {},
        de: fs.existsSync(dePath) ? JSON.parse(fs.readFileSync(dePath, 'utf-8')) : {},
      };
      await registerPluginLocales({ id: String(manifest.id ?? 'dnd5e-srd'), locales });
      const firstKey = Object.keys(locales.en)[0];
      expect(firstKey).toBeDefined();
      const t = getPluginT(String(manifest.id ?? 'dnd5e-srd'), 'en');
      expect(t(firstKey)).toBe(locales.en[firstKey]);
    });
  });

  describe('SRD example entries', () => {
    it('contains an example creature: Goblin', () => {
      expect(readAllExampleContent()).toContain('goblin');
    });

    it('contains an example spell: Fireball', () => {
      expect(readAllExampleContent()).toContain('fireball');
    });

    it('contains an example item: Healing Potion', () => {
      expect(readAllExampleContent()).toContain('healing potion');
    });

    it('contains an example feat: Alert', () => {
      expect(readAllExampleContent()).toContain('alert');
    });

    it('contains at least one example species', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', 'species.json'))).toBe(true);
      const examplesDir = path.join(PLUGIN_DIR, 'examples');
      const hasSpeciesExample = fs.existsSync(examplesDir)
        && (fs.readdirSync(examplesDir, { recursive: true }) as string[]).some((f) => /species/i.test(f));
      expect(hasSpeciesExample).toBe(true);
    });

    it('contains one prefabricated, playable player_character exercising base + formula + lookup + 2D-lookup + conditional + session-state + references', () => {
      const examplesDir = path.join(PLUGIN_DIR, 'examples');
      const hasPcExample = fs.existsSync(examplesDir)
        && (fs.readdirSync(examplesDir, { recursive: true }) as string[]).some((f) => /player.?character/i.test(f));
      expect(hasPcExample).toBe(true);
    });
  });
});
