// @vitest-environment jsdom
// M10 / #390: gemerkter Play-Kontext (Campaign + Rolle) je Projekt — Persistenz.
import { afterEach, describe, expect, it } from 'vitest';
import { getPlayContext, setPlayContext, clearPlayContext } from '../src/services/play-context-store';

afterEach(() => localStorage.clear());

describe('M10-#390 play-context-store', () => {
  it('null solange nichts gemerkt ist', () => {
    expect(getPlayContext('p1')).toBeNull();
  });

  it('merkt Campaign + Rolle, projekt-scoped', () => {
    setPlayContext('p1', { campaignId: 'c1', role: 'dm' });
    expect(getPlayContext('p1')).toEqual({ campaignId: 'c1', role: 'dm' });
    expect(getPlayContext('p2')).toBeNull(); // andere Projekt-ID sieht nichts
  });

  it('clear löscht den Merker', () => {
    setPlayContext('p1', { campaignId: 'c1', role: 'player' });
    clearPlayContext('p1');
    expect(getPlayContext('p1')).toBeNull();
  });

  it('ignoriert beschädigte/ungültige Einträge', () => {
    localStorage.setItem('wbx:playContext:p1', '{ not json');
    expect(getPlayContext('p1')).toBeNull();
    localStorage.setItem('wbx:playContext:p1', JSON.stringify({ campaignId: 'c1', role: 'spectator' }));
    expect(getPlayContext('p1')).toBeNull(); // ungültige Rolle
    localStorage.setItem('wbx:playContext:p1', JSON.stringify({ role: 'dm' }));
    expect(getPlayContext('p1')).toBeNull(); // fehlende campaignId
  });
});
