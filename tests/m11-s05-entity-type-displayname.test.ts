// @vitest-environment node
// M11-S05: Entity-Typ-Namen i18n — displayName i18n key per type,
// canonical ID unchanged as storage key.
// See: https://github.com/Djimon/WorldBrain/issues/213

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ENTITY_TYPE_SCHEMA_PATH = 'core_data/entity-type-schemas.ts';
const LOCALES_ROOT = 'src/locales';

const CORE_TYPES = ['Character', 'Location', 'Faction', 'Item', 'Event'];

describe('M11-S05 entity-type i18n displayName', () => {
  describe('core_data/entity-type-schemas.ts', () => {
    it('entity-type-schemas.ts file exists', () => {
      expect(existsSync(ENTITY_TYPE_SCHEMA_PATH)).toBe(true);
    });

    it('exports entity type definitions', async () => {
      const mod = await import('../core_data/entity-type-schemas');
      expect(mod).toBeDefined();
      // Should export an array or record of entity type definitions
      const exported = Object.values(mod);
      expect(exported.length).toBeGreaterThan(0);
    });

    it('each entity type definition has a displayNameKey field', async () => {
      const mod = await import('../core_data/entity-type-schemas') as Record<string, unknown>;
      const defs = Object.values(mod).flat();
      for (const def of defs) {
        if (typeof def === 'object' && def !== null && 'id' in def) {
          expect(def, `${(def as {id: string}).id} must have displayNameKey`).toHaveProperty('displayNameKey');
        }
      }
    });

    it.each(CORE_TYPES)('%s type definition has a displayNameKey', async (typeName) => {
      const mod = await import('../core_data/entity-type-schemas') as Record<string, unknown>;
      const src = readFileSync(ENTITY_TYPE_SCHEMA_PATH, 'utf-8');
      expect(src).toContain(typeName);
      expect(src).toContain('displayNameKey');
    });

    it('canonical IDs are unchanged (not localized)', async () => {
      const src = readFileSync(ENTITY_TYPE_SCHEMA_PATH, 'utf-8');
      // IDs must still be the English canonical names used as storage keys
      for (const type of CORE_TYPES) {
        expect(src).toContain(type);
      }
    });
  });

  describe('locale keys for entity types', () => {
    it('en/entity.json contains displayName keys for all core types', () => {
      expect(existsSync(`${LOCALES_ROOT}/en/entity.json`)).toBe(true);
      const data = JSON.parse(readFileSync(`${LOCALES_ROOT}/en/entity.json`, 'utf-8')) as Record<string, unknown>;
      for (const type of CORE_TYPES) {
        const key = `type.${type.toLowerCase()}`;
        expect(data, `en/entity.json must have key "${key}"`).toHaveProperty(key);
      }
    });

    it('de/entity.json contains displayName keys for all core types', () => {
      expect(existsSync(`${LOCALES_ROOT}/de/entity.json`)).toBe(true);
      const data = JSON.parse(readFileSync(`${LOCALES_ROOT}/de/entity.json`, 'utf-8')) as Record<string, unknown>;
      for (const type of CORE_TYPES) {
        const key = `type.${type.toLowerCase()}`;
        expect(data, `de/entity.json must have key "${key}"`).toHaveProperty(key);
      }
    });

    it('de/entity.json translates "Character" to "Charakter"', () => {
      expect(existsSync(`${LOCALES_ROOT}/de/entity.json`)).toBe(true);
      const data = JSON.parse(readFileSync(`${LOCALES_ROOT}/de/entity.json`, 'utf-8')) as Record<string, string>;
      expect(data['type.character']).toBe('Charakter');
    });
  });

  describe('storage keys are not locale-dependent', () => {
    it('entity-type-schemas source does not store translated labels as IDs', () => {
      const src = readFileSync(ENTITY_TYPE_SCHEMA_PATH, 'utf-8');
      // IDs must not contain German translations as values
      expect(src).not.toContain('"Charakter"');
      expect(src).not.toContain('"Ort"');
    });
  });
});
