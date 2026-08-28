// @vitest-environment jsdom
// M10: Campaign-Log-Aggregation (#379, D23 — gerettet aus #338)
// See: https://github.com/Djimon/WorldBrain/issues/379

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#379 CampaignLog source guards', () => {
  it('CampaignLog component exists', () => {
    const source = readFileSync('src/ui/CampaignLog.tsx', 'utf-8');
    expect(source).toMatch(/export.*CampaignLog/);
  });

  it('aggregates session_log entries chronologically', () => {
    const source = readFileSync('src/ui/CampaignLog.tsx', 'utf-8');
    expect(source).toMatch(/session_log|ORDER BY.*created_at/i);
  });

  it('renders session-change separator', () => {
    const source = readFileSync('src/ui/CampaignLog.tsx', 'utf-8');
    expect(source).toMatch(/separator|divider|section.*header|session.*break/i);
  });

  it('uses primitives (ListSurface or Panel)', () => {
    const source = readFileSync('src/ui/CampaignLog.tsx', 'utf-8');
    expect(source).toMatch(/import.*(?:ListSurface|Panel).*from.*primitives/);
  });

  it('no new log table or object created', () => {
    const schema = readFileSync('src/data/runtime/schema.sql', 'utf-8');
    expect(schema).not.toMatch(/CREATE TABLE.*campaign_log/i);
  });

  it('accepts database prop typed as DatabaseLike', () => {
    const source = readFileSync('src/ui/CampaignLog.tsx', 'utf-8');
    expect(source).toMatch(/database.*DatabaseLike|DatabaseLike/);
  });
});
