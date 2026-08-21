// @vitest-environment jsdom
// M10-S24: Campaign-Mitglieder-Panel — persistente Roster-Verwaltung
// See: https://github.com/Djimon/WorldBrain/issues/347

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source guards — S24 blocked by S20
// ---------------------------------------------------------------------------

describe('M10-S24 Source guards', () => {
  it('CampaignRosterPanel component exists', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/export.*CampaignRosterPanel/);
  });

  it('CampaignRosterPanel uses ListSurface from primitives', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/import.*ListSurface.*from.*primitives/);
  });

  it('CampaignRosterPanel uses StatusChip for active/kicked status', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/import.*StatusChip.*from.*primitives/);
  });

  it('CampaignRosterPanel has readonly Field + copy Button for invite code', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/import.*Field.*from.*primitives/);
    expect(source).toMatch(/clipboard/i);
  });

  it('CampaignRosterPanel has kick (remove member) functionality', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/kick|remove|entfernen/i);
  });

  it('CampaignRosterPanel has regenerate invite code functionality', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/regenerat|invalidat|neu.*generier/i);
  });

  it('CampaignRosterPanel does not use prompt() or alert()', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).not.toMatch(/\bprompt\s*\(/);
    expect(source).not.toMatch(/\balert\s*\(/);
  });

  it('CampaignRosterPanel is campaign-scoped (uses campaign_id)', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/campaign_id|campaignId/);
  });
});
