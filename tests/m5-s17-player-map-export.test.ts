// @vitest-environment node
// E8-S09: Player-facing map export — visibility projection, progressive reveal, PNG/HTML output.
// See: https://github.com/Djimon/WorldBrain/issues/83

import { describe, expect, it } from 'vitest';

async function getExport() { return import('../src/services/player-map-export'); }

const baseMap = {
  id: 'map-1',
  title: 'World Map',
  asset_id: 'asset-1',
  image_width_px: 1000,
  image_height_px: 800,
  calibration_json: null,
};

const publicMarker = { id: 'mk1', map_id: 'map-1', kind: 'pin', geometry_json: '{"x":100,"y":200}', label_text: 'Public Place', entity_id: null, visibility: 'public' };
const gmMarker    = { id: 'mk2', map_id: 'map-1', kind: 'pin', geometry_json: '{"x":300,"y":400}', label_text: 'GM Secret', entity_id: null, visibility: 'gm_only' };
const knownMarker = { id: 'mk3', map_id: 'map-1', kind: 'pin', geometry_json: '{"x":500,"y":600}', label_text: 'Known Place', entity_id: 'char-ada', visibility: 'player_known' };

const playerCtx = { role: 'player' as const, knownEntities: ['char-ada'], sessionVars: {}, globalVars: {} };
const gmCtx     = { role: 'gm' as const, knownEntities: [], sessionVars: {}, globalVars: {} };

describe('E8-S09 player map export', () => {
  describe('generatePlayerMapHtml export', () => {
    it('exports generatePlayerMapHtml function', async () => {
      const mod = await getExport();
      expect(typeof mod.generatePlayerMapHtml).toBe('function');
    });

    it('returns a string starting with <!DOCTYPE or <html', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const result = generatePlayerMapHtml({ map: baseMap, markers: [publicMarker], context: playerCtx });
      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toMatch(/^<!doctype|^<html/);
    });
  });

  describe('visibility projection for player', () => {
    it('includes public marker labels for player', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const html = generatePlayerMapHtml({ map: baseMap, markers: [publicMarker], context: playerCtx });
      expect(html).toContain('Public Place');
    });

    it('excludes gm_only markers for player', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const html = generatePlayerMapHtml({ map: baseMap, markers: [gmMarker], context: playerCtx });
      expect(html).not.toContain('GM Secret');
    });

    it('includes player_known marker when entity is in knownEntities', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const html = generatePlayerMapHtml({ map: baseMap, markers: [knownMarker], context: playerCtx });
      expect(html).toContain('Known Place');
    });

    it('excludes player_known marker when entity is NOT in knownEntities', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const ctx = { ...playerCtx, knownEntities: [] };
      const html = generatePlayerMapHtml({ map: baseMap, markers: [knownMarker], context: ctx });
      expect(html).not.toContain('Known Place');
    });
  });

  describe('GM context sees all', () => {
    it('GM export includes gm_only markers', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const html = generatePlayerMapHtml({ map: baseMap, markers: [gmMarker], context: gmCtx });
      expect(html).toContain('GM Secret');
    });
  });

  describe('self-contained output', () => {
    it('HTML output contains no external stylesheet or script URLs', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const html = generatePlayerMapHtml({ map: baseMap, markers: [publicMarker], context: playerCtx });
      // Must not reference CDN or external URLs in link/script tags
      expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
      expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    });

    it('includes the map title in the output', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const html = generatePlayerMapHtml({ map: baseMap, markers: [], context: playerCtx });
      expect(html).toContain('World Map');
    });

    it('includes marker geometry data for client-side rendering', async () => {
      const { generatePlayerMapHtml } = await getExport();
      const html = generatePlayerMapHtml({ map: baseMap, markers: [publicMarker], context: playerCtx });
      // geometry coordinates should be embedded
      expect(html).toMatch(/100|200/);
    });
  });

  describe('progressive reveal', () => {
    it('exports applyProgressiveReveal function', async () => {
      const mod = await getExport();
      expect(typeof mod.applyProgressiveReveal).toBe('function');
    });

    it('applyProgressiveReveal accepts a list of revealed entity IDs and filters markers', async () => {
      const { applyProgressiveReveal } = await getExport();
      const markers = [publicMarker, knownMarker];
      const result = applyProgressiveReveal(markers, { revealedEntityIds: ['char-ada'] });
      expect(result.map((m: { id: string }) => m.id)).toContain('mk3');
    });

    it('applyProgressiveReveal hides player_known markers not yet revealed', async () => {
      const { applyProgressiveReveal } = await getExport();
      const markers = [knownMarker];
      const result = applyProgressiveReveal(markers, { revealedEntityIds: [] });
      expect(result.map((m: { id: string }) => m.id)).not.toContain('mk3');
    });
  });
});

// Bug #126: XSS in player-map-export — </script> in map.title breaks HTML structure
describe('issue #126: XSS escaping in player map export script block', () => {
  it('map title containing </script> does not break the HTML structure', async () => {
    const { generatePlayerMapHtml } = await getExport();
    const map = { id: 'map-1', title: '</script><script>alert(1)</script>', markers: [] };
    const html = generatePlayerMapHtml({ map, context: { audience: 'player', revealedEntityIds: [] } });
    expect(html).not.toMatch(/<\/script><script>/i);
  });

  it('</script> sequence in title is escaped in the JSON payload', async () => {
    const { generatePlayerMapHtml } = await getExport();
    const map = { id: 'map-xss', title: 'x</script>y', markers: [] };
    const html = generatePlayerMapHtml({ map, context: { audience: 'player', revealedEntityIds: [] } });
    // The raw </script> tag must not appear inside the <script> block
    const scriptContent = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? '';
    expect(scriptContent).not.toContain('</script>');
  });
});
