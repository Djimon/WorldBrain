// M6-S02: Core renderer registry — 24 named renderers, extensible, graceful unknown handling.
// See: https://github.com/Djimon/WorldBrain/issues/92

import { describe, expect, it } from 'vitest';

async function getRegistry() { return import('../src/services/renderer-registry'); }

const GENERAL_RENDERERS = [
  'core.text_input', 'core.text_area', 'core.rich_text', 'core.number_input',
  'core.boolean_toggle', 'core.select', 'core.multi_select', 'core.date_time_picker',
  'core.entity_picker', 'core.relation_picker', 'core.repeater', 'core.condition_builder',
  'core.file_asset_picker', 'core.map_coordinate_picker', 'core.dice_expression_input',
  'core.markdown_preview',
];

const WORLD_RENDERERS = [
  'core.entity_embed', 'core.secret_block', 'core.map_marker_editor',
  'core.timeline_event_editor', 'core.card_preview', 'core.statblock_editor',
  'core.rule_reference_block', 'core.capture_inbox_item',
];

describe('M6-S02 core renderer registry', () => {
  describe('exports', () => {
    it('exports getRenderer function', async () => {
      const mod = await getRegistry();
      expect(typeof mod.getRenderer).toBe('function');
    });

    it('exports registerRenderer function', async () => {
      const mod = await getRegistry();
      expect(typeof mod.registerRenderer).toBe('function');
    });
  });

  describe('24 built-in renderers', () => {
    it('all 16 general renderers are registered', async () => {
      const { getRenderer } = await getRegistry();
      for (const name of GENERAL_RENDERERS) {
        expect(getRenderer(name), `Missing renderer: ${name}`).toBeDefined();
      }
    });

    it('all 8 worldbuilding renderers are registered', async () => {
      const { getRenderer } = await getRegistry();
      for (const name of WORLD_RENDERERS) {
        expect(getRenderer(name), `Missing renderer: ${name}`).toBeDefined();
      }
    });

    it('total registered renderers is 24', async () => {
      const { listRenderers } = await getRegistry();
      expect(listRenderers().length).toBe(24);
    });
  });

  describe('unknown renderer', () => {
    it('getRenderer returns null/undefined for unknown name — no throw', async () => {
      const { getRenderer } = await getRegistry();
      expect(() => getRenderer('core.does_not_exist')).not.toThrow();
      expect(getRenderer('core.does_not_exist')).toBeFalsy();
    });
  });

  describe('extensibility', () => {
    it('registerRenderer adds a new renderer resolvable by name', async () => {
      const { registerRenderer, getRenderer } = await getRegistry();
      const FakeComp = () => null;
      registerRenderer('plugin.my_renderer', FakeComp);
      expect(getRenderer('plugin.my_renderer')).toBe(FakeComp);
    });
  });
});
