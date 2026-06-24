// @vitest-environment node
// M6-S05: Plugin card templates & assets — load templates, icons, color tokens from plugins.
// See: https://github.com/Djimon/WorldBrain/issues/95

import { describe, expect, it, vi } from 'vitest';

async function getPluginAssetService() { return import('../src/services/plugin-asset-service'); }

const pluginTemplate = {
  id: 'plugin-dragon-card',
  label: 'Dragon Card',
  entity_types: ['dragon'],
  size_mm: { width_mm: 63, height_mm: 88 },
  layout: { slots: [] },
  style: {},
};

describe('M6-S05 plugin card templates & assets', () => {
  describe('card templates', () => {
    it('exports registerPluginCardTemplate function', async () => {
      const mod = await getPluginAssetService();
      expect(typeof mod.registerPluginCardTemplate).toBe('function');
    });

    it('plugin template appears in card template registry', async () => {
      const { registerPluginCardTemplate, listCardTemplates } = await getPluginAssetService();
      registerPluginCardTemplate(pluginTemplate);
      const templates = listCardTemplates();
      expect(templates.some((t: { id: string }) => t.id === 'plugin-dragon-card')).toBe(true);
    });

    it('plugin template filtered by entity type in card creation flow', async () => {
      const { registerPluginCardTemplate, listCardTemplatesForEntityType } = await getPluginAssetService();
      registerPluginCardTemplate(pluginTemplate);
      const dragonTemplates = listCardTemplatesForEntityType('dragon');
      expect(dragonTemplates.some((t: { id: string }) => t.id === 'plugin-dragon-card')).toBe(true);
      const characterTemplates = listCardTemplatesForEntityType('Character');
      expect(characterTemplates.some((t: { id: string }) => t.id === 'plugin-dragon-card')).toBe(false);
    });

    it('conflict: same template id second plugin wins + warning', async () => {
      const { registerPluginCardTemplate, listCardTemplates } = await getPluginAssetService();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerPluginCardTemplate({ ...pluginTemplate, label: 'v1' });
      registerPluginCardTemplate({ ...pluginTemplate, label: 'v2' });
      const tpl = listCardTemplates().find((t: { id: string }) => t.id === 'plugin-dragon-card');
      expect(tpl?.label).toBe('v2');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('icon assets', () => {
    it('exports registerPluginIcon function', async () => {
      const mod = await getPluginAssetService();
      expect(typeof mod.registerPluginIcon).toBe('function');
    });

    it('registered icon retrievable by name', async () => {
      const { registerPluginIcon, getIcon } = await getPluginAssetService();
      const svgContent = '<svg><circle/></svg>';
      registerPluginIcon('dragon-icon', svgContent);
      expect(getIcon('dragon-icon')).toBe(svgContent);
    });
  });

  describe('color tokens', () => {
    it('exports registerPluginColorTokens function', async () => {
      const mod = await getPluginAssetService();
      expect(typeof mod.registerPluginColorTokens).toBe('function');
    });

    it('plugin color tokens merged into theme token registry', async () => {
      const { registerPluginColorTokens, getColorToken } = await getPluginAssetService();
      registerPluginColorTokens({ 'dragon-red': '#cc3300' });
      expect(getColorToken('dragon-red')).toBe('#cc3300');
    });

    it('no custom CSS files — only color tokens accepted', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/services/plugin-asset-service.ts', 'utf8');
      // Should not handle .css file loading
      expect(src).not.toMatch(/\.css|loadStylesheet|injectStyle/i);
    });
  });
});
