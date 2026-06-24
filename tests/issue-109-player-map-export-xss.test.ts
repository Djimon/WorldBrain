// @vitest-environment node
// Issue #109: XSS vulnerability in player-map-export.ts — raw HTML interpolation of user input.

import { describe, expect, it } from 'vitest';

async function getExport() { return import('../src/services/player-map-export'); }

const baseMap = { id: 'map-1', title: 'World Map', asset_id: 'a1', image_width_px: 1000, image_height_px: 800, calibration_json: null };
const playerCtx = { role: 'player' as const, knownEntities: [], sessionVars: {}, globalVars: {} };

describe('issue-109 XSS in player map export', () => {
  it('map title with <script> is escaped in HTML output', async () => {
    const { generatePlayerMapHtml } = await getExport();
    const maliciousMap = { ...baseMap, title: '<script>alert(1)</script>' };
    const html = generatePlayerMapHtml({ map: maliciousMap, markers: [], context: playerCtx });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toMatch(/&lt;script&gt;|&#x3C;script&#x3E;/);
  });

  it('marker label_text with <script> is escaped in HTML output', async () => {
    const { generatePlayerMapHtml } = await getExport();
    const xssMarker = { id: 'mk1', map_id: 'map-1', kind: 'pin', geometry_json: '{}', label_text: '<img src=x onerror=alert(1)>', entity_id: null, visibility: 'public' };
    const html = generatePlayerMapHtml({ map: baseMap, markers: [xssMarker], context: playerCtx });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toMatch(/&lt;img|&#x3C;img/);
  });

  it('marker id with </div> injection is escaped', async () => {
    const { generatePlayerMapHtml } = await getExport();
    const xssMarker = { id: '</div><script>alert(2)</script>', map_id: 'map-1', kind: 'pin', geometry_json: '{}', label_text: 'Safe', entity_id: null, visibility: 'public' };
    const html = generatePlayerMapHtml({ map: baseMap, markers: [xssMarker], context: playerCtx });
    expect(html).not.toContain('<script>alert(2)</script>');
  });

  it('source does not use raw template literal for title or label_text', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/services/player-map-export.ts', 'utf8');
    // Must not have ${map.title} or ${m.label_text} unescaped
    expect(src).not.toMatch(/\$\{map\.title\}|\$\{m\.label_text\}|\$\{marker\.label_text\}/);
  });

  it('source uses an escapeHtml helper or equivalent', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/services/player-map-export.ts', 'utf8');
    expect(src).toMatch(/escapeHtml|escape\(|encodeHTML|sanitize/i);
  });
});
