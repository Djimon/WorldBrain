// @vitest-environment jsdom
// M17-S03 (#382): Integrationstest durch den ECHTEN WorkspaceShell-Mount.
// AC: „den Modus real umschalten und prüfen, dass der Akzent von Rot auf Amber
// wechselt — nicht nur isoliertes render()." jsdom rechnet keine CSS-Kaskade aus
// Stylesheets, daher wird der MECHANISMUS geprüft, der den Akzent schaltet:
// `document.documentElement[data-mode]` (die Achse, an der die --mode-accent-
// Tokens in tokens.css hängen) flippt edit⟷play, und das Modus-Marken-Label
// wechselt RealmForge⟷Adventure Nexus.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ECHTES i18n (kein react-i18next-Mock) — damit die Marken-Keys aus der Registry
// (#381, common-Namespace) real zu „Worlds and Beyond"/„RealmForge"/„Adventure Nexus"
// auflösen und der Test den echten gerenderten Text prüfen kann (#382/#383).
import '../src/i18n';

vi.mock('../src/services/DatabaseContext', () => ({
  useDatabase: () => ({ execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) }),
  DatabaseContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../src/services/plugin-entity-service', () => ({
  listEntityTypes: vi.fn().mockReturnValue([]), registerPluginEntityType: vi.fn(), getEntityType: vi.fn(),
  registerPluginRelationType: vi.fn(), getRelationTypeDefinition: vi.fn(), listPluginRelationTypes: vi.fn().mockReturnValue([]), flagOutdatedSchema: vi.fn(),
}));
vi.mock('../src/services/map-service', () => ({ listMaps: vi.fn().mockResolvedValue([]), importMapImage: vi.fn() }));
vi.mock('../src/services/saved-views-service', () => ({ listViews: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/services/rule-import-service', () => ({ importRules: vi.fn() }));
vi.mock('../src/services/rule-evaluations', () => ({
  detectMysteryBreakers: vi.fn().mockResolvedValue([]), analyzeRoleCoverage: vi.fn().mockResolvedValue([]), detectQuestBlockers: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/services/calendar-service', () => ({ listCalendars: vi.fn().mockResolvedValue([]), setActiveCalendar: vi.fn(), deleteCalendar: vi.fn() }));
vi.mock('../../core_data/calendar-schema', () => ({ formatCalendarDate: vi.fn().mockReturnValue('') }));
vi.mock('../src/services/event-entity-service', () => ({ createEventEntity: vi.fn() }));
vi.mock('../src/services/map-layer-service', () => ({ importImageLayer: vi.fn(), createFogLayer: vi.fn() }));
vi.mock('@tauri-apps/api/webviewWindow', () => {
  const WebviewWindow = vi.fn().mockImplementation(() => ({ once: vi.fn(), listen: vi.fn() }));
  (WebviewWindow as unknown as Record<string, unknown>).getByLabel = vi.fn().mockResolvedValue(null);
  return { WebviewWindow };
});
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn().mockResolvedValue('') }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(null) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: vi.fn().mockResolvedValue(''), writeTextFile: vi.fn().mockResolvedValue(undefined), exists: vi.fn().mockResolvedValue(false) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null) }));

const stubComponent = (name: string) =>
  (props: Record<string, unknown>) => React.createElement('div', { 'data-testid': `stub-${name}`, ...props });

vi.mock('../src/ui/EntityMasterDetail', () => ({ EntityMasterDetail: stubComponent('EntityMasterDetail') }));
vi.mock('../src/ui/EntityDetailView', () => ({ EntityDetailView: stubComponent('EntityDetailView') }));
vi.mock('../src/ui/GlobalSearch', () => ({ GlobalSearch: stubComponent('GlobalSearch') }));
vi.mock('../src/ui/ChronicleView', () => ({ ChronicleView: stubComponent('ChronicleView') }));
vi.mock('../src/ui/CalendarWizard', () => ({ CalendarWizard: stubComponent('CalendarWizard') }));
vi.mock('../src/ui/CalendarMonthView', () => ({ CalendarMonthView: stubComponent('CalendarMonthView') }));
vi.mock('../src/ui/CalendarLinkPanel', () => ({ CalendarLinkPanel: stubComponent('CalendarLinkPanel') }));
vi.mock('../src/ui/CardList', () => ({ CardList: stubComponent('CardList') }));
vi.mock('../src/ui/CardCreationFlow', () => ({ CardCreationFlow: stubComponent('CardCreationFlow') }));
vi.mock('../src/ui/PrintSheetComposer', () => ({ PrintSheetComposer: stubComponent('PrintSheetComposer') }));
vi.mock('../src/ui/PluginManager', () => ({ PluginManager: stubComponent('PluginManager') }));
vi.mock('../src/ui/DmScreen', () => ({ DmScreen: stubComponent('DmScreen'), DmScreenSelector: stubComponent('DmScreenSelector') }));
vi.mock('../src/ui/SnapshotManager', () => ({ SnapshotManager: stubComponent('SnapshotManager') }));
vi.mock('../src/ui/UpdateNotification', () => ({ UpdateNotification: stubComponent('UpdateNotification') }));
vi.mock('../src/ui/MapViewer', () => ({ MapViewer: stubComponent('MapViewer') }));
vi.mock('../src/ui/GlobalGraphView', () => ({ GlobalGraphView: stubComponent('GlobalGraphView') }));
vi.mock('../src/ui/LayerPanel', () => ({ LayerPanel: stubComponent('LayerPanel') }));
vi.mock('../src/ui/MapsSidebarTabs', () => ({ MapsSidebarTabs: stubComponent('MapsSidebarTabs') }));
vi.mock('../src/ui/MapFolderTree', () => ({ MapFolderTree: stubComponent('MapFolderTree') }));
vi.mock('../src/ui/LanguageSwitcher', () => ({ LanguageSwitcher: stubComponent('LanguageSwitcher') }));
vi.mock('../src/ui/ThemeToggle', () => ({ ThemeToggle: stubComponent('ThemeToggle') }));
vi.mock('../src/ui/primitives', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('button', props),
  Panel: (props: Record<string, unknown>) => React.createElement('div', props),
  Field: (props: Record<string, unknown>) => React.createElement('input', props),
  StatusChip: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('span', props, children),
  Segmented: ({ label, value, options, onChange }: {
    label: string; value: string; options: readonly { id: string; label: React.ReactNode }[]; onChange: (id: string) => void;
  }) => React.createElement('div', { role: 'group', 'aria-label': label },
    options.map((opt) => React.createElement('button',
      { key: opt.id, 'aria-pressed': opt.id === value, onClick: () => onChange(opt.id) }, opt.label))),
}));
// #420 (S1): the cockpit (PlayModeView) is gone; play mode now renders the play-sidebar
// views. Stub the play children so entering play stays light.
vi.mock('../src/ui/LobbyPanel', () => ({ LobbyPanel: stubComponent('LobbyPanel') }));
vi.mock('../src/ui/SessionTimeBar', () => ({ SessionTimeBar: stubComponent('SessionTimeBar') }));
vi.mock('../src/ui/SessionTimeControls', () => ({ SessionTimeControls: stubComponent('SessionTimeControls') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlayerJoinView', () => ({ PlayerJoinView: stubComponent('PlayerJoinView') }));

afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-mode'); });

describe('M17-S03 mode-accent switches on real mode toggle (mount)', () => {
  async function getShell() {
    const mod = await import('../src/ui/WorkspaceShell');
    return mod.WorkspaceShell;
  }
  const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
  const editSeg = () => screen.getByRole('button', { name: 'Bearbeiten' });
  const asDm = () => screen.getByRole('button', { name: /Als DM/i });

  it('edit mode: data-mode=edit, platform Worlds and Beyond + RealmForge brand shown', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));
    // #389: EINE einfarbige Wortmarke „Worlds and Beyond – RealmForge" (ein Element).
    const wm = document.querySelector('.workspace-shell__wordmark');
    expect(wm?.textContent).toContain('Worlds and Beyond');
    expect(wm?.textContent).toContain('RealmForge');
  });

  it('switching to play flips data-mode=play and the brand to Adventure Nexus (accent axis red→amber)', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));

    fireEvent.click(playSeg());
    await waitFor(() => expect(asDm()).toBeTruthy());
    fireEvent.click(asDm());

    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('play'));
    // Plattform bleibt; Modus-Teil wechselt RealmForge→Adventure Nexus (Decision 2).
    const wm = document.querySelector('.workspace-shell__wordmark');
    expect(wm?.textContent).toContain('Worlds and Beyond');
    expect(wm?.textContent).toContain('Adventure Nexus');
    // Non-color mode cue #2 (Decision 4): das Live-Schloss erscheint.
    expect(screen.getByText('🔒')).toBeTruthy();
  });

  it('switching back to edit restores data-mode=edit', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    fireEvent.click(playSeg());
    await waitFor(() => asDm());
    fireEvent.click(asDm());
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('play'));
    fireEvent.click(editSeg());
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));
  });
});
