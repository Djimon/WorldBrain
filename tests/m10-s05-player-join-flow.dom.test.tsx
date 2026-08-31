// @vitest-environment jsdom
// M10-S05 (rebuild): Campaign beitreten (Spieler-Modus-Client, Auto-Join)
// See: https://github.com/Djimon/WorldBrain/issues/354

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source guards — S05 blocked by S01/S02/S22
// ---------------------------------------------------------------------------

describe('M10-S05 Source guards', () => {
  it('PlayerJoinView component exists', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/export.*PlayerJoinView/);
  });

  it('PlayerJoinView has no server-URL field (only code/link field)', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/server.*url|serverUrl|server-url/i);
  });

  it('PlayerJoinView auto-joins via transport handshake, not a local joinWithCode (#387 DB-less)', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    // #387/D29: DB-loser Client — Auto-Join (D24) läuft als join_request über den
    // Transport, NICHT als lokaler joinWithCode-DB-Call. Der Host validiert.
    expect(source).toMatch(/join_request|JOIN_REQUEST/);
    expect(source).not.toMatch(/joinWithCode\s*\(/);
  });

  it('PlayerJoinView shows no pending state', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/pending|warte.*bestätigung|waiting.*approval/i);
  });

  it('PlayerJoinView uses Field from primitives (not raw input)', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/import.*Field.*from.*primitives/);
  });

  it('PlayerJoinView uses Button from primitives (not raw button)', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/import.*Button.*from.*primitives/);
  });

  it('error display uses StatusChip from primitives', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/import.*StatusChip.*from.*primitives/);
  });
});
