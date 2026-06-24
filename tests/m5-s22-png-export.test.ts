// @vitest-environment node
// M5-S22: PNG export via canvas.toBlob() — no server-side rendering.
// See: https://github.com/Djimon/WorldBrain/issues/88

import { describe, expect, it } from 'vitest';

async function getPngExport() { return import('../src/services/png-export'); }

const sampleCard = {
  id: 'card-1', entity_id: 'char-ada', template_id: 'tpl-npc', audience: 'players',
  label: 'Ada Thorn', category: 'NPC',
  size_mm: { width_mm: 63, height_mm: 88 },
  fields: { name: 'Ada Thorn', summary: 'Archivist' },
};

describe('M5-S22 PNG export', () => {
  describe('exports', () => {
    it('exports exportCardToPng function', async () => {
      const mod = await getPngExport();
      expect(typeof mod.exportCardToPng).toBe('function');
    });

    it('exports exportPrintSheetToPng function', async () => {
      const mod = await getPngExport();
      expect(typeof mod.exportPrintSheetToPng).toBe('function');
    });

    it('exports RESOLUTION_PRESETS', async () => {
      const mod = await getPngExport();
      const presets = mod.RESOLUTION_PRESETS ?? mod.resolutionPresets;
      expect(presets).toBeDefined();
      const keys = Object.keys(presets);
      expect(keys.some(k => /screen|72/i.test(k))).toBe(true);
      expect(keys.some(k => /print|150/i.test(k))).toBe(true);
      expect(keys.some(k => /high|300/i.test(k))).toBe(true);
    });
  });

  describe('no server-side rendering', () => {
    it('source uses canvas.toBlob or toDataURL — not puppeteer', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/services/png-export.ts', 'utf8');
      expect(src).not.toMatch(/puppeteer|playwright|chromium/i);
      expect(src).toMatch(/toBlob|toDataURL|createCanvas/i);
    });
  });

  describe('CardRenderer interface', () => {
    it('exports CardRenderer or renderCard function used by both PDF and PNG', async () => {
      const mod = await getPngExport();
      expect(typeof (mod.renderCard ?? mod.CardRenderer)).not.toBe('undefined');
    });
  });

  describe('resolution', () => {
    it('300 dpi preset multiplier is 300/72 or equivalent', async () => {
      const mod = await getPngExport();
      const presets = mod.RESOLUTION_PRESETS ?? mod.resolutionPresets;
      const highRes = Object.values(presets).find((v: unknown) =>
        typeof v === 'object' && v !== null && 'dpi' in v && (v as { dpi: number }).dpi === 300
      );
      expect(highRes).toBeDefined();
    });
  });
});
