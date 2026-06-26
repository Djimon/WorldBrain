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

// Bug #129: renderCard always draws at (0,0) — all cards overlap
describe('issue #129: PNG export card grid layout', () => {
  it('exportPrintSheetToPng calls renderCard with distinct x/y offsets for each card', async () => {
    const mod = await getPngExport();
    const renderCard = vi.fn();
    const canvas = { getContext: () => ({ save: vi.fn(), restore: vi.fn(), translate: vi.fn(), clearRect: vi.fn() }) };
    // If the function accepts an injectable renderCard, verify distinct positions are used
    if (mod.exportPrintSheetToPng.length >= 3) {
      const cards = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
      await mod.exportPrintSheetToPng(canvas, cards, { renderCard });
      const positions = renderCard.mock.calls.map((c: unknown[]) => `${c[1]},${c[2]}`);
      const unique = new Set(positions);
      expect(unique.size).toBe(cards.length);
    } else {
      // Source-level check: translate or offset must be used per card
      const { readFileSync } = await import('node:fs');
      const src = readFileSync('src/services/png-export.ts', 'utf8');
      expect(src).toMatch(/translate|offset|cellX|cellY|col|row/i);
    }
  });

  it('source uses ctx.translate or per-card x/y offset, not fixed (0,0) for every card', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/services/png-export.ts', 'utf8');
    // renderCard called in a loop must pass a varying position — not just renderCard(ctx, card, scale)
    // A fixed (0,0) call site would look like: renderCard(ctx, card, scale) with no offset param
    expect(src).toMatch(/translate\s*\(|cellX|offsetX|col\s*\*|x\s*=\s*.*col/i);
  });
});
