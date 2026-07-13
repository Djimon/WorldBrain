// Lore-Entity: eigenständige undatierte Lore (story/backstory/secret/
// prophecy/rumor…)
// See: https://github.com/Djimon/WorldBrain/issues/271
//
// Note: D2 (generic entity, no new mechanism) — Lore reuses the entire
// existing entity machinery (EntityMasterDetail.createEntity, PropertiesForm,
// visibility field, relations). No dedicated Lore service module is created
// (there is nothing Lore-specific to build beyond the type registration +
// schema entry + i18n label). AP-001/AP-006 do not apply here — no new
// DatabaseLike-consuming function is introduced.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LORE_KIND_SUGGESTIONS } from '../src/data/lore-schema';
import { getSchemaForType } from '../src/data/entity-type-schemas';

describe('Lore-Entity (#271)', () => {
  describe('LORE_KIND_SUGGESTIONS: 8 seed values, DM-extensible (no DB enum)', () => {
    it('exports exactly 8 seed lore-kind suggestions', () => {
      expect(LORE_KIND_SUGGESTIONS.length).toBe(8);
    });

    it('matches the AC seed list', () => {
      expect([...LORE_KIND_SUGGESTIONS].sort()).toEqual(
        ['backstory', 'history', 'legend', 'prophecy', 'readout', 'rumor', 'secret', 'story'],
      );
    });
  });

  describe('Lore entity type is registered with a soft lore_kind field', () => {
    it('getSchemaForType("Lore") declares a lore_kind property', () => {
      const schema = getSchemaForType('Lore');
      expect(schema.properties.lore_kind).toBeDefined();
    });

    it('lore_kind is a plain string field, not a closed enum (D1: no DB-enum constraint)', () => {
      const schema = getSchemaForType('Lore');
      expect(schema.properties.lore_kind?.type).toBe('string');
      expect(schema.properties.lore_kind?.enum).toBeUndefined();
    });
  });

  describe('Lore is a selectable entity type in the app (type registry)', () => {
    it('WorkspaceShell.tsx lists "Lore" among its core entity types', () => {
      const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
      const listMatch = src.match(/CORE_ENTITY_TYPES\s*=\s*\[([\s\S]*?)\]/);
      expect(listMatch?.[1]).toMatch(/'Lore'/);
    });
  });

  describe('no hardcoded UI strings: type.lore i18n key exists', () => {
    it('the German entity locale has a type.lore translation', () => {
      const locale = JSON.parse(readFileSync('src/locales/de/entity.json', 'utf-8'));
      expect(locale['type.lore']).toBeTruthy();
    });
  });
});
