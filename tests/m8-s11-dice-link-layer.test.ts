// @vitest-environment node
// M8-S11: Globaler Dice-Link-Layer
// See: https://github.com/Djimon/WorldBrain/issues/163

import { describe, expect, it } from 'vitest';

async function getDiceLinkLayer() { return import('../src/services/dice-link-layer'); }

describe('M8-S11 global dice link layer', () => {
  describe('parseDiceExpressions', () => {
    it('detects "XdY" notation', async () => {
      const { parseDiceExpressions } = await getDiceLinkLayer();
      const results = parseDiceExpressions('Roll 2d6 for damage');
      expect(results).toContainEqual(expect.objectContaining({ expression: '2d6' }));
    });

    it('detects "XdY+Z" notation', async () => {
      const { parseDiceExpressions } = await getDiceLinkLayer();
      const results = parseDiceExpressions('Attack: 1d20+5');
      expect(results).toContainEqual(expect.objectContaining({ expression: '1d20+5' }));
    });

    it('detects "XdY-Z" notation', async () => {
      const { parseDiceExpressions } = await getDiceLinkLayer();
      const results = parseDiceExpressions('Damage: 3d8-2');
      expect(results).toContainEqual(expect.objectContaining({ expression: '3d8-2' }));
    });

    it('detection is case-insensitive (1D6 = 1d6)', async () => {
      const { parseDiceExpressions } = await getDiceLinkLayer();
      const results = parseDiceExpressions('Roll 1D6');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for text with no dice notation', async () => {
      const { parseDiceExpressions } = await getDiceLinkLayer();
      const results = parseDiceExpressions('No dice here, just text');
      expect(results).toEqual([]);
    });

    it('returns match positions (start, end) for each expression', async () => {
      const { parseDiceExpressions } = await getDiceLinkLayer();
      const text = 'Roll 2d6 for damage';
      const results = parseDiceExpressions(text);
      expect(results[0]).toHaveProperty('start');
      expect(results[0]).toHaveProperty('end');
    });

    it('does not match inside input/editor contexts (marked region)', async () => {
      const { parseDiceExpressions } = await getDiceLinkLayer();
      // Strings marked as "editor" context should be excluded
      const results = parseDiceExpressions('2d6', { context: 'editor' });
      expect(results).toEqual([]);
    });
  });

  describe('renderDiceLinks (HTML output)', () => {
    it('wraps dice expression in a clickable span', async () => {
      const { renderDiceLinks } = await getDiceLinkLayer();
      const html = renderDiceLinks('Roll 2d6 for damage');
      expect(html).toContain('<span');
      expect(html).toContain('2d6');
      expect(html).toContain('data-dice-expression');
    });

    it('HTML-escapes surrounding user text before output', async () => {
      const { renderDiceLinks } = await getDiceLinkLayer();
      const html = renderDiceLinks('<b>Bold</b> roll 1d6');
      expect(html).not.toContain('<b>Bold</b>');
      expect(html).toContain('&lt;b&gt;');
    });

    it('does not wrap dice expressions in editor/input context', async () => {
      const { renderDiceLinks } = await getDiceLinkLayer();
      const html = renderDiceLinks('2d6', { context: 'editor' });
      expect(html).not.toContain('data-dice-expression');
    });
  });

  describe('isPlayMode guard', () => {
    it('dice-link-layer source references play mode condition', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/dice-link-layer.ts', 'utf-8'));
      expect(src).toMatch(/play.?mode|playMode|isPlay/i);
    });
  });
});
