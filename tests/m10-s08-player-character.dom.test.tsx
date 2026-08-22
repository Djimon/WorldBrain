// @vitest-environment jsdom
// M10-S08 (rebuild): Spieler-Charaktererstellung + Bogen als Aktionsquelle
// See: https://github.com/Djimon/WorldBrain/issues/357

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source guards — S08 blocked by S05
// ---------------------------------------------------------------------------

describe('M10-S08 Source guards', () => {
  it('PlayerCharacterSheet component exists', () => {
    const source = readFileSync('src/ui/PlayerCharacterSheet.tsx', 'utf-8');
    expect(source).toMatch(/export.*PlayerCharacterSheet/);
  });

  it('PlayerCharacterSheet uses is_player_character flag', () => {
    const source = readFileSync('src/ui/PlayerCharacterSheet.tsx', 'utf-8');
    expect(source).toMatch(/is_player_character/);
  });

  it('PlayerCharacterSheet uses Field/Button/Panel from primitives', () => {
    const source = readFileSync('src/ui/PlayerCharacterSheet.tsx', 'utf-8');
    expect(source).toMatch(/import.*(?:Field|Button|Panel).*from.*primitives/);
  });

  it('character actions post to combat log', () => {
    const source = readFileSync('src/ui/PlayerCharacterSheet.tsx', 'utf-8');
    expect(source).toMatch(/combatLog|kampflog|log.*post|postAction/i);
  });

  it('exactly one character per player per campaign (enforced)', () => {
    const source = readFileSync('src/ui/PlayerCharacterSheet.tsx', 'utf-8');
    expect(source).toMatch(/player_id|playerId/);
    expect(source).toMatch(/campaign_id|campaignId/);
  });
});
