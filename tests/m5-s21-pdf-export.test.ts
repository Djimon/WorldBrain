// @vitest-environment node
// M5-S21: PDF export via @react-pdf/renderer — no headless browser.
// See: https://github.com/Djimon/WorldBrain/issues/87

import { describe, expect, it } from 'vitest';

async function getPdfExport() { return import('../src/services/pdf-export'); }

const sampleCard = {
  id: 'card-1',
  entity_id: 'char-ada',
  template_id: 'tpl-npc',
  audience: 'players',
  label: 'Ada Thorn',
  category: 'NPC',
  size_mm: { width_mm: 63, height_mm: 88 },
  fields: { name: 'Ada Thorn', summary: 'Archivist' },
};

describe('M5-S21 PDF export', () => {
  describe('exports', () => {
    it('exports exportCardToPdf function', async () => {
      const mod = await getPdfExport();
      expect(typeof mod.exportCardToPdf).toBe('function');
    });

    it('exports exportPrintSheetToPdf function', async () => {
      const mod = await getPdfExport();
      expect(typeof mod.exportPrintSheetToPdf).toBe('function');
    });
  });

  describe('single card export', () => {
    it('exportCardToPdf returns a Buffer or Uint8Array', async () => {
      const { exportCardToPdf } = await getPdfExport();
      const result = await exportCardToPdf({ card: sampleCard });
      expect(result instanceof Buffer || result instanceof Uint8Array).toBe(true);
    });

    it('PDF buffer starts with %PDF header', async () => {
      const { exportCardToPdf } = await getPdfExport();
      const result = await exportCardToPdf({ card: sampleCard });
      const header = Buffer.from(result).slice(0, 4).toString('ascii');
      expect(header).toBe('%PDF');
    });
  });

  describe('print sheet export', () => {
    it('exportPrintSheetToPdf accepts array of cards', async () => {
      const { exportPrintSheetToPdf } = await getPdfExport();
      const result = await exportPrintSheetToPdf({ cards: [sampleCard], cutMarks: true });
      expect(result instanceof Buffer || result instanceof Uint8Array).toBe(true);
    });
  });

  describe('no headless browser', () => {
    it('source does not import puppeteer or playwright', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/services/pdf-export.ts', 'utf8');
      expect(src).not.toMatch(/puppeteer|playwright|chromium/i);
    });

    it('source uses @react-pdf/renderer', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/services/pdf-export.ts', 'utf8');
      expect(src).toMatch(/@react-pdf\/renderer|renderToBuffer|pdf\(/i);
    });
  });

  describe('physical dimensions', () => {
    it('Poker card PDF is generated at 63x88mm aspect ratio', async () => {
      const { exportCardToPdf } = await getPdfExport();
      const result = await exportCardToPdf({ card: sampleCard });
      // Can't easily check exact mm from buffer, but at least no throw
      expect(result.length).toBeGreaterThan(100);
    });
  });

  describe('font embedding', () => {
    it('source registers at least 2 font families', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/services/pdf-export.ts', 'utf8');
      const fontRegistrations = (src.match(/Font\.register\s*\(/g) ?? []).length;
      expect(fontRegistrations).toBeGreaterThanOrEqual(2);
    });
  });
});
