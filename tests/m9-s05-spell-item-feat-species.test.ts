// @vitest-environment node
// M9-S05: Spell / Item / Feat / Species Schemas
// See: https://github.com/Djimon/WorldBrain/issues/168

import { describe, expect, it } from 'vitest';

async function getSchemaValidator() { return import('../src/services/system-entity-schema-validator'); }

const VALID_SPELL = {
  type: 'spell',
  id: 'fireball',
  name: 'Feuerball',
  level: 3,
  school: 'Evocation',
  casting_time: '1 action',
  range: '150 ft',
  components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A bright streak flashes…',
  damage_expression: '8d6',
};

const VALID_ITEM = {
  type: 'item',
  id: 'healing-potion',
  name: 'Heiltrank',
  item_type: 'Potion',
  rarity: 'Common',
  weight: 0.5,
  value: '50gp',
  description: 'Restores 2d4+2 HP',
  special_abilities: '',
};

const VALID_FEAT = {
  type: 'feat',
  id: 'alert',
  name: 'Alert',
  prerequisite: null,
  description: '+5 to Initiative, cannot be surprised',
  mechanical_effect: '+5 Initiative',
};

const VALID_SPECIES = {
  type: 'species',
  id: 'elf',
  name: 'Elf',
  attribute_score_increases: { dex: 2 },
  traits: ['Darkvision', 'Fey Ancestry', 'Trance'],
  subspecies: ['High Elf', 'Wood Elf', 'Dark Elf'],
};

describe('M9-S05 spell/item/feat/species schemas', () => {
  describe('spell schema', () => {
    it('validates a valid spell entity', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const result = validateSystemEntity(VALID_SPELL);
      expect(result.valid).toBe(true);
    });

    it('spell missing level is invalid', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const { level: _l, ...bad } = VALID_SPELL;
      expect(validateSystemEntity(bad).valid).toBe(false);
    });

    it('spell has damage_expression field (may be null for non-damage spells)', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const noDamage = { ...VALID_SPELL, damage_expression: null };
      expect(validateSystemEntity(noDamage).valid).toBe(true);
    });
  });

  describe('item schema', () => {
    it('validates a valid item entity', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const result = validateSystemEntity(VALID_ITEM);
      expect(result.valid).toBe(true);
    });

    it('item missing item_type is invalid', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const { item_type: _t, ...bad } = VALID_ITEM;
      expect(validateSystemEntity(bad).valid).toBe(false);
    });
  });

  describe('feat schema', () => {
    it('validates a valid feat entity', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const result = validateSystemEntity(VALID_FEAT);
      expect(result.valid).toBe(true);
    });

    it('feat prerequisite may be null', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      expect(validateSystemEntity({ ...VALID_FEAT, prerequisite: null }).valid).toBe(true);
    });
  });

  describe('species schema', () => {
    it('validates a valid species entity', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const result = validateSystemEntity(VALID_SPECIES);
      expect(result.valid).toBe(true);
    });

    it('subspecies is optional', async () => {
      const { validateSystemEntity } = await getSchemaValidator();
      const noSub = { ...VALID_SPECIES, subspecies: undefined };
      expect(validateSystemEntity(noSub).valid).toBe(true);
    });
  });

  describe('dice expression recognition', () => {
    it('spell damage_expression "8d6" is recognized by dice-link-layer', async () => {
      const { parseDiceExpressions } = await import('../src/services/dice-link-layer');
      const results = parseDiceExpressions('8d6 fire damage');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].expression).toBe('8d6');
    });

    it('item description "2d4+2 HP" dice expression is recognized', async () => {
      const { parseDiceExpressions } = await import('../src/services/dice-link-layer');
      const results = parseDiceExpressions('Restores 2d4+2 HP');
      expect(results.some(r => r.expression.includes('2d4'))).toBe(true);
    });
  });

  describe('HTML escaping', () => {
    it('system-entity-schema-validator.ts does not produce raw HTML with user strings', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/system-entity-schema-validator.ts', 'utf-8'));
      const producesHtml = src.includes('innerHTML') || src.includes('dangerouslySetInner');
      if (producesHtml) {
        expect(src).toMatch(/escapeHtml|escape.*html|sanitize/i);
      } else {
        expect(true).toBe(true);
      }
    });
  });
});
