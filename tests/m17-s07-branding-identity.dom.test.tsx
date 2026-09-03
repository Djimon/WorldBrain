// @vitest-environment jsdom
// M17-S07 (#389): Header-Identität zusammenführen (EINE Wortmarke „Worlds and Beyond
// – RealmForge/Adventure Nexus") + modus-abhängiger OS-Fenstertitel.
// Integrationstest durch den ECHTEN WorkspaceShell-Mount (analog m17-s03-mount);
// setTitle ist gemockt und wird auf den korrekten Titel geprüft.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n';

const { setTitle } = vi.hoisted(() => ({ setTitle: vi.fn(() => Promise.resolve()) }));

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
  // #389: setTitle-Spy über den echten Bezugsweg WebviewWindow.getCurrent().
  (WebviewWindow as unknown as Record<string, unknown>).getCurrent = vi.fn(() => ({ setTitle }));
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
// #420 (S1): the cockpit (PlayModeView) is gone; play mode now renders the play-sidebar
// views. Stub the play children so entering play stays light.
vi.mock('../src/ui/LobbyPanel', () => ({ LobbyPanel: stubComponent('LobbyPanel') }));
vi.mock('../src/ui/SessionTimeBar', () => ({ SessionTimeBar: stubComponent('SessionTimeBar') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlayerJoinView', () => ({ PlayerJoinView: stubComponent('PlayerJoinView') }));

afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-mode'); setTitle.mockClear(); });

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}
const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
const asDm = () => screen.getByRole('button', { name: /Als DM/i });

describe('M17-S07 merged wordmark through real WorkspaceShell mount', () => {
  it('renders ONE wordmark containing platform + edit mode mark', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));
    const wm = document.querySelector('.workspace-shell__wordmark');
    expect(wm).toBeTruthy();
    // Beide Marken stecken in EINEM Wortmarken-Element (zusammengeführt).
    // #389 (einfarbig, ein String/eine Klasse): Plattform + Modus-Teil in EINEM
    // Wortmarken-Element zusammengeführt.
    expect(wm!.textContent).toContain('Worlds and Beyond');
    expect(wm!.textContent).toContain('RealmForge');
  });

  it('project + area names still present but as secondary elements', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));
    expect(document.querySelector('.workspace-shell__project-name')).toBeTruthy();
    expect(document.querySelector('.workspace-shell__area-name')).toBeTruthy();
  });

  it('sets OS window title to "Worlds and Beyond – RealmForge" in edit mode', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await waitFor(() => expect(setTitle).toHaveBeenCalledWith('Worlds and Beyond – RealmForge'));
  });

  it('switching to play flips the wordmark mode part AND the window title', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));

    fireEvent.click(playSeg());
    await waitFor(() => expect(asDm()).toBeTruthy());
    fireEvent.click(asDm());

    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('play'));
    const wm = document.querySelector('.workspace-shell__wordmark');
    expect(wm!.textContent).toContain('Adventure Nexus');
    expect(wm!.textContent).toContain('Worlds and Beyond');
    await waitFor(() => expect(setTitle).toHaveBeenCalledWith('Worlds and Beyond – Adventure Nexus'));
  });
});

describe('M17-S07 styling guards (CSS source)', () => {
  it('the wordmark carries the mode-accent token (einfarbig, #389)', () => {
    const css = readFileSync('src/styles/components/shell.css', 'utf-8');
    // Nach dem Rebrand ist die ganze Wortmarke EINE Klasse, einfarbig im Modus-Akzent.
    expect(css).toMatch(/\.workspace-shell__wordmark\s*\{[^}]*--mode-accent-text/);
  });

  it('project + area names are demoted to muted secondary text', () => {
    const css = readFileSync('src/styles/components/shell.css', 'utf-8');
    const proj = css.slice(css.indexOf('.workspace-shell__project-name'));
    expect(proj).toMatch(/color:\s*var\(--color-text-muted\)/);
  });

  it('static window title preset is "Worlds and Beyond"', () => {
    const conf = readFileSync('src-tauri/tauri.conf.json', 'utf-8');
    expect(conf).toMatch(/"title":\s*"Worlds and Beyond"/);
  });

  it('#401: main-window capability grants set-title', () => {
    // Ohne core:window:allow-set-title lehnt die Tauri-v2-ACL das set_title-
    // Command ab → die setTitle-Promise (WorkspaceShell) rejectet und der
    // OS-Fenstertitel bleibt auf dem statischen Preset "Worlds and Beyond".
    // core:window:default enthält nur Getter (allow-title = lesen), NICHT den Setter.
    const cap = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf-8'));
    expect(cap.permissions).toContain('core:window:allow-set-title');
  });
});
