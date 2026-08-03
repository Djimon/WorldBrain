// M16-S06: Graph-Controls — Modus-Switcher (Galaxy⇄Ring), Verlinkungen-Toggle,
// Glow-Schalter, Legende + Start-Default (#319)
// AP-008 (RTL): getByRole mit exaktem Namen; AP-003: kein prompt/alert/confirm.
// Keine hardcodierten UI-Strings: useTranslation + inline German default.
// AP-005: ESM import only, no require().

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalGraphView } from '../src/ui/GlobalGraphView';

// react-i18next: t(key, default) → default zurückgeben, damit die inline
// German defaults als Buttonbeschriftungen sichtbar sind (kein Provider nötig).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def: string) => def,
    i18n: { language: 'de', changeLanguage: vi.fn() },
  }),
}));

// cap: via vi.hoisted(), damit der vi.mock-Factory-Block sicher darauf
// zugreifen kann (kein TDZ-Problem wie bei plain class/const-Deklarationen).
const cap = vi.hoisted(() => ({
  layout: undefined as { mode: string; clusterStrength?: number } | undefined,
  links: [] as Array<{ source: string; target: string; kind: string }>,
  glow: undefined as boolean | undefined,
}));

vi.mock('../src/ui/GraphCanvas', () => ({
  GraphCanvas: (props: {
    layout?: { mode: string; clusterStrength?: number };
    links?: Array<{ source: string; target: string; kind: string }>;
    glowEnabled?: boolean;
  }) => {
    cap.layout = props.layout;
    cap.links = props.links ?? [];
    cap.glow = props.glowEnabled;
    return null;
  },
}));

// getAllRelations konfigurierbar per Test (via vi.hoisted + mockResolvedValue).
const { mockGetAllRelations } = vi.hoisted(() => ({
  mockGetAllRelations: vi.fn(),
}));
vi.mock('../src/services/relation-service', () => ({
  getAllRelations: mockGetAllRelations,
}));

// Testdaten: entity a mit @[Beta](b)-Mention in summary → mention-Link a→b.
// getAllRelations liefert Relation a→c → relation-Link a→c.
// D9: keine Überschneidung → beide Links überleben buildGraphModel.
const ENTITIES = [
  { id: 'a', type: 'Character', title: 'Alpha', summary: '@[Beta](b)', properties_json: null, body_json: null },
  { id: 'b', type: 'Location', title: 'Beta', summary: null, properties_json: null, body_json: null },
  { id: 'c', type: 'Faction', title: 'Gamma', summary: null, properties_json: null, body_json: null },
];

function makeDb() {
  return { select: vi.fn().mockResolvedValue(ENTITIES) };
}

describe('M16-S06: Graph-Controls', () => {
  beforeEach(() => {
    cap.layout = undefined;
    cap.links = [];
    cap.glow = undefined;
    mockGetAllRelations.mockResolvedValue([
      { id: 'r1', source_id: 'a', target_id: 'c', relation_type: 'knows', inverse_type: '', active: 1, visibility_json: null, notes: null },
    ]);
  });

  it('Mount: Galaxy-Modus aktiv (mode=galaxy, clusterStrength>0)', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={() => {}} />);
    await waitFor(() => expect(cap.layout).toBeDefined());
    expect(cap.layout?.mode).toBe('galaxy');
    expect(cap.layout?.clusterStrength ?? 0).toBeGreaterThan(0);
  });

  it('Ring-Button → mode wechselt auf ring', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={() => {}} />);
    await waitFor(() => expect(cap.layout).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Ring' }));
    expect(cap.layout?.mode).toBe('ring');
  });

  it('Galaxy-Button nach Ring → zurück auf galaxy', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={() => {}} />);
    await waitFor(() => expect(cap.layout).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Ring' }));
    fireEvent.click(screen.getByRole('button', { name: 'Galaxy' }));
    expect(cap.layout?.mode).toBe('galaxy');
    expect(cap.layout?.clusterStrength ?? 0).toBeGreaterThan(0);
  });

  it('Verlinkungen-Toggle aus → keine mention-Links an GraphCanvas; Relations bleiben', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={() => {}} />);
    await waitFor(() => expect(cap.links.some((l) => l.kind === 'mention')).toBe(true));
    expect(cap.links.some((l) => l.kind === 'relation')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Verlinkungen' }));
    expect(cap.links.some((l) => l.kind === 'mention')).toBe(false);
    expect(cap.links.some((l) => l.kind === 'relation')).toBe(true);
  });

  it('Glow Default aus; Glow-Schalter an → glowEnabled=true', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={() => {}} />);
    await waitFor(() => expect(cap.layout).toBeDefined());
    expect(cap.glow).toBeFalsy();
    fireEvent.click(screen.getByRole('button', { name: 'Glow' }));
    expect(cap.glow).toBe(true);
  });

  it('Legende zeigt Relation (dick) und Verlinkung (dünn)', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={() => {}} />);
    await waitFor(() => expect(cap.layout).toBeDefined());
    expect(screen.getByText('Relation (dick)')).toBeTruthy();
    expect(screen.getByText('Verlinkung (dünn)')).toBeTruthy();
  });
});
