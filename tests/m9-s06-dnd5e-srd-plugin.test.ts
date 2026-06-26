// @vitest-environment node
// M9-S06: D&D 5e SRD Beispiel-Plugin
// See: https://github.com/Djimon/WorldBrain/issues/169

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const PLUGIN_DIR = path.join('plugins', 'dnd5e-srd');
const MANIFEST_PATH = path.join(PLUGIN_DIR, 'plugin.json');

describe('M9-S06 D&D 5e SRD example plugin', () => {
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
  });

  describe('plugin.json manifest', () => {
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch {
      manifest = {};
    }

    it('has system: true', () => {
      expect(manifest.system).toBe(true);
    });

    it('has mechanics block with attributes', () => {
      const mechanics = manifest.mechanics as Record<string, unknown> | undefined;
      expect(mechanics?.attributes).toContain('str');
      expect(mechanics?.attributes).toContain('dex');
      expect(mechanics?.attributes).toContain('con');
      expect(mechanics?.attributes).toContain('int');
      expect(mechanics?.attributes).toContain('wis');
      expect(mechanics?.attributes).toContain('cha');
    });

    it('challenge_metric is "cr"', () => {
      const mechanics = manifest.mechanics as Record<string, unknown> | undefined;
      expect(mechanics?.challenge_metric).toBe('cr');
    });

    it('distance_units includes "ft" and "mile"', () => {
      const mechanics = manifest.mechanics as Record<string, unknown> | undefined;
      const units = mechanics?.distance_units as string[] | undefined;
      expect(units).toContain('ft');
      expect(units).toContain('mile');
    });

    it('resource_types includes hp and spell slots', () => {
      const mechanics = manifest.mechanics as Record<string, unknown> | undefined;
      const rt = mechanics?.resource_types as string[] | undefined;
      expect(rt?.some(r => r.includes('hp'))).toBe(true);
      expect(rt?.some(r => r.includes('spell'))).toBe(true);
    });
  });

  describe('entity type schemas', () => {
    it('player_character.json entity type exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', 'player_character.json'))).toBe(true);
    });

    it('creature.json entity type exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', 'creature.json'))).toBe(true);
    });

    it('spell.json entity type exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', 'spell.json'))).toBe(true);
    });

    it('item.json entity type exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', 'item.json'))).toBe(true);
    });

    it('feat.json entity type exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', 'feat.json'))).toBe(true);
    });

    it('species.json entity type exists', () => {
      expect(fs.existsSync(path.join(PLUGIN_DIR, 'entity_types', 'species.json'))).toBe(true);
    });
  });

  describe('computed ability modifiers', () => {
    it('player_character.json defines str_modifier as computed field', () => {
      const pcSchemaPath = path.join(PLUGIN_DIR, 'entity_types', 'player_character.json');
      if (!fs.existsSync(pcSchemaPath)) return;
      const schema = JSON.parse(fs.readFileSync(pcSchemaPath, 'utf-8'));
      const strModField = schema.fields?.find((f: { id: string }) => f.id === 'str_modifier');
      expect(strModField?.computed).toBe(true);
      expect(strModField?.formula).toBe('floor((str - 10) / 2)');
    });
  });

  describe('SRD example entries', () => {
    it('contains at least one example creature (Goblin)', () => {
      const examplesDir = path.join(PLUGIN_DIR, 'examples');
      const entries = fs.existsSync(examplesDir) ? fs.readdirSync(examplesDir, { recursive: true }) : [];
      const allContent = entries.map(f => {
        try { return fs.readFileSync(path.join(examplesDir, f as string), 'utf-8'); } catch { return ''; }
      }).join('');
      expect(allContent.toLowerCase()).toContain('goblin');
    });

    it('contains at least one example spell (Fireball)', () => {
      const examplesDir = path.join(PLUGIN_DIR, 'examples');
      const entries = fs.existsSync(examplesDir) ? fs.readdirSync(examplesDir, { recursive: true }) : [];
      const allContent = entries.map(f => {
        try { return fs.readFileSync(path.join(examplesDir, f as string), 'utf-8'); } catch { return ''; }
      }).join('');
      expect(allContent.toLowerCase()).toContain('fireball');
    });
  });

  describe('plugin validation', () => {
    it('plugin passes validatePluginManifest without errors', async () => {
      if (!fs.existsSync(MANIFEST_PATH)) return;
      const { validatePluginManifest } = await import('../src/services/plugin-validator');
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);
    });
  });
});
