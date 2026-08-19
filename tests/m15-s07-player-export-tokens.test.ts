// M15-S07 (#279): player-map export includes only player_visible layers,
// honors each fog layer's visible state, exports tokens on a player-visible
// token layer, and HTML-escapes all user-supplied strings (AP-004).

import { describe, expect, it } from 'vitest';
import { generatePlayerMapHtml, type LayerData, type TokenData } from '../src/services/player-map-export';

const map = { id: 'map-1', title: 'Karte', asset_id: 'a.png', image_width_px: 100, image_height_px: 100, calibration_json: null };
const context = { role: 'player' as const, knownEntities: [], sessionVars: {}, globalVars: {} };

const layers: LayerData[] = [
  { id: 'img_shown', layer_type: 'image', visible: 1, player_visible: 1, asset_id: 'a.png' },
  { id: 'img_dm', layer_type: 'image', visible: 1, player_visible: 0, asset_id: 'gm.png' },
  { id: 'fog_active', layer_type: 'fog', visible: 1, player_visible: 1, mask_data: 'data:x' },
  { id: 'fog_revealed', layer_type: 'fog', visible: 0, player_visible: 1, mask_data: 'data:y' },
  { id: 'tok_layer', layer_type: 'token', visible: 1, player_visible: 1 },
  { id: 'tok_hidden', layer_type: 'token', visible: 1, player_visible: 0 },
];

function tok(overrides: Partial<TokenData>): TokenData {
  return {
    id: 't1', layer_id: 'tok_layer', label: 'Held', entity_id: null,
    counters_json: '[]', status_chips_json: '[]', x: 10, y: 10,
    ...overrides,
  };
}

describe('M15-S07 player export: layers/tokens/escaping', () => {
  it('includes player_visible image layers and excludes DM-only ones', () => {
    const html = generatePlayerMapHtml({ map, markers: [], context, layers, tokens: [] });
    expect(html).toContain('img_shown');
    expect(html).not.toContain('img_dm');
  });

  it('honors fog visible state: active fog in, revealed (visible=0) fog out', () => {
    const html = generatePlayerMapHtml({ map, markers: [], context, layers, tokens: [] });
    expect(html).toContain('fog_active');
    expect(html).not.toContain('fog_revealed');
  });

  it('exports tokens on a player-visible token layer, not on a hidden one', () => {
    const tokens = [tok({ id: 'shown', label: 'Recke', layer_id: 'tok_layer' }), tok({ id: 'hidden', label: 'Spion', layer_id: 'tok_hidden' })];
    const html = generatePlayerMapHtml({ map, markers: [], context, layers, tokens });
    expect(html).toContain('Recke');
    expect(html).not.toContain('Spion');
  });

  it('HTML-escapes user-supplied token strings (AP-004)', () => {
    const tokens = [tok({ id: 'xss', label: '<script>alert(1)</script>', counters_json: JSON.stringify([{ label: '<b>HP</b>', value: 5 }]) })];
    const html = generatePlayerMapHtml({ map, markers: [], context, layers, tokens });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes status-chip text in the rendered token list', () => {
    // The <li> token list HTML-escapes chip text (the <script> JSON payload is
    // inert JS-string data, protected separately by </script> neutralization —
    // same convention as the marker list).
    const tokens = [tok({ id: 'c', label: 'A', status_chips_json: JSON.stringify([{ icon: '☠', text: '<i>Gift</i>' }]) })];
    const html = generatePlayerMapHtml({ map, markers: [], context, layers, tokens });
    expect(html).toContain('&lt;i&gt;Gift&lt;/i&gt;');
  });

  it('backward compatible: works without layers/tokens', () => {
    const html = generatePlayerMapHtml({ map, markers: [], context });
    expect(html).toContain('<!DOCTYPE html>');
  });
});
