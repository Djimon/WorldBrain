// @vitest-environment jsdom
// M10 fix(P1): Roster + Mitglieder + Gruppen-Zuordnung in Play-Lobby (#377, D31)
// See: https://github.com/Djimon/WorldBrain/issues/377

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#377 Play-Lobby roster source guards', () => {
  it('LobbyPanel renders campaign-scoped member list', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/session_players|listMembers|campaign.*member/i);
  });

  it('LobbyPanel shows online/offline status per member', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/online|offline|StatusChip/i);
  });

  it('LobbyPanel has kick action', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/kick|Kick/);
  });

  it('LobbyPanel has group assignment toggle per member', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/group.*assign|addMember|toggleGroup/i);
  });

  it('uses primitives (ListSurface, Button, StatusChip, Panel)', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/import.*(?:ListSurface|Panel|Button|StatusChip).*from.*primitives/);
  });

  it('accepts database prop typed as DatabaseLike', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/database.*DatabaseLike|DatabaseLike/);
  });

  it('no Campaign CRUD in LobbyPanel (that belongs in edit panel)', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).not.toMatch(/createCampaign|deleteCampaign|Neue Campaign/i);
  });
});
