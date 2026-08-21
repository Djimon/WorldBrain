// @vitest-environment jsdom
// M10-S06 (rebuild): GM-Lobby — verbundene Spieler + Kick + Copy-Code
// See: https://github.com/Djimon/WorldBrain/issues/355

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source guards — S06 blocked by S01/S02/S03/S22
// ---------------------------------------------------------------------------

describe('M10-S06 Source guards', () => {
  it('LobbyPanel component exists', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/export.*LobbyPanel/);
  });

  it('LobbyPanel has no approve/reject buttons', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).not.toMatch(/approve|reject|genehmigen|ablehnen/i);
  });

  it('LobbyPanel has no pending section', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).not.toMatch(/pending|wartend/i);
  });

  it('LobbyPanel has kick functionality', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/kick/i);
  });

  it('LobbyPanel has no SignalingPanel (WebRTC-Signaling is S11/S12)', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).not.toMatch(/SignalingPanel/);
  });

  it('LobbyPanel uses ListSurface from primitives', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/import.*ListSurface.*from.*primitives/);
  });

  it('LobbyPanel uses StatusChip for online/offline', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/import.*StatusChip.*from.*primitives/);
  });

  it('LobbyPanel uses readonly Field + copy Button (D27)', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/import.*Field.*from.*primitives/);
    expect(source).toMatch(/clipboard/i);
  });

  it('LobbyPanel does not use prompt() or alert()', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).not.toMatch(/\bprompt\s*\(/);
    expect(source).not.toMatch(/\balert\s*\(/);
  });
});
