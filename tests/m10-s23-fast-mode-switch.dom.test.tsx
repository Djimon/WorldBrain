// @vitest-environment jsdom
// M10 / #390: Schneller Edit⟷Play-Wechsel — gemerkter Play-Kontext + Play-Settings.
// Integrationstest durch den ECHTEN WorkspaceShell-Mount (analog m17-s03-mount).
// Der play-context-store (localStorage) ist ECHT (kein Mock) → die „gemerkt"-
// Behaviour wird end-to-end geprüft. campaign-service ist gemockt.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n';

vi.mock('../src/services/campaign-service', () => ({
  listCampaigns: vi.fn(async () => [{ id: 'c1', title: 'Kampagne 1' }, { id: 'c2', title: 'Kampagne 2' }]),
  createCampaign: vi.fn(async (_db: unknown, { title }: { title: string }) => ({ id: 'cnew', title })),
}));

// STABILE db-Identität (vi.hoisted): eine wechselnde db-Referenz je Render würde
// den Host-Transport-Effekt (dep: database) endlos re-feuern → OOM.
const { db } = vi.hoisted(() => ({ db: { execute: () => Promise.resolve(undefined), select: () => Promise.resolve([]) } }));
vi.mock('../src/services/DatabaseContext', () => ({
  useDatabase: () => db,
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
vi.mock('../src/services/webrtc-transport', () => ({
  WebRtcTransport: {
    host: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      attachSignaling: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(() => () => {}),
      send: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));
vi.mock('@tauri-apps/api/webviewWindow', () => {
  const WebviewWindow = vi.fn().mockImplementation(() => ({ once: vi.fn(), listen: vi.fn() }));
  (WebviewWindow as unknown as Record<string, unknown>).getByLabel = vi.fn().mockResolvedValue(null);
  (WebviewWindow as unknown as Record<string, unknown>).getCurrent = vi.fn(() => ({ setTitle: vi.fn(() => Promise.resolve()) }));
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
// #420 (S1): cockpit dissolved → stub the play-sidebar children; DM lobby view
// (stub-LobbyPanel) is the "in play mode" marker.
vi.mock('../src/ui/LobbyPanel', () => ({ LobbyPanel: stubComponent('LobbyPanel') }));
vi.mock('../src/ui/SessionTimeBar', () => ({ SessionTimeBar: stubComponent('SessionTimeBar') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlayerJoinView', () => ({ PlayerJoinView: stubComponent('PlayerJoinView') }));
vi.mock('../src/ui/primitives', () => ({
  Button: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('button', props, children),
  Panel: (props: Record<string, unknown>) => React.createElement('div', props),
  Field: (props: Record<string, unknown>) => React.createElement('input', props),
  StatusChip: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('span', props, children),
  ListRow: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('button', props, children),
  Segmented: ({ label, value, options, onChange }: {
    label: string; value: string; options: readonly { id: string; label: React.ReactNode }[]; onChange: (id: string) => void;
  }) => React.createElement('div', { role: 'group', 'aria-label': label },
    options.map((opt) => React.createElement('button',
      { key: opt.id, 'aria-pressed': opt.id === value, onClick: () => onChange(opt.id) }, opt.label))),
}));

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-mode');
  localStorage.clear();
});

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}
const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
const editSeg = () => screen.getByRole('button', { name: 'Bearbeiten' });
const asDm = () => screen.getByRole('button', { name: /Als DM/i });
const roleDialog = () => screen.queryByRole('dialog');
const cockpit = () => screen.queryByTestId('stub-LobbyPanel');

/** edit→play über den Auswahl-Schritt: Spielen → Kampagne 1 → Als DM → Cockpit. */
async function establishPlayViaDialog() {
  fireEvent.click(playSeg());
  await waitFor(() => expect(roleDialog()).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Kampagne 1' }));
  fireEvent.click(asDm());
  await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('play'));
  await waitFor(() => expect(cockpit()).toBeTruthy());
}

describe('M10-#390 fast Edit⟷Play switch (real WorkspaceShell mount)', () => {
  it('(1) first play shows the role-select; Als DM + campaign → play cockpit', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));
    await establishPlayViaDialog();
    expect(roleDialog()).toBeNull(); // Auswahl-Schritt geschlossen
  });

  it('(2) back to edit, then play again → DIRECTLY in cockpit, no role-select', async () => {
    const Shell = await getShell();
    render(React.createElement(Shell));
    await establishPlayViaDialog();

    fireEvent.click(editSeg());
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));

    fireEvent.click(playSeg());
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('play'));
    // KEIN Auswahl-Schritt — direkt im Cockpit, gleicher Kontext.
    expect(roleDialog()).toBeNull();
    await waitFor(() => expect(cockpit()).toBeTruthy());
  });

  it('(3) "Session verlassen" in play-settings → next play shows role-select again', async () => {
    const Shell = await getShell();
    const { container } = render(React.createElement(Shell));
    await establishPlayViaDialog();

    // in den Play-Settings-Bereich wechseln und Session verlassen
    fireEvent.click(container.querySelector('[data-area="play-settings"]')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Session verlassen' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-mode')).toBe('edit'));

    // nächster Play-Wechsel fragt wieder (Kontext gelöscht)
    fireEvent.click(playSeg());
    await waitFor(() => expect(roleDialog()).toBeTruthy());
  });

  it('(4) switching campaign in play-settings changes the active session without an edit detour', async () => {
    const Shell = await getShell();
    const { container } = render(React.createElement(Shell));
    await establishPlayViaDialog();

    fireEvent.click(container.querySelector('[data-area="play-settings"]')!);
    const kampagne2 = await screen.findByRole('button', { name: 'Kampagne 2' });
    fireEvent.click(kampagne2);
    // aktive Session ist jetzt c2 (Segmented value = activeSessionId) …
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kampagne 2' }).getAttribute('aria-pressed')).toBe('true'));
    // … und wir sind NICHT über edit gelaufen.
    expect(document.documentElement.getAttribute('data-mode')).toBe('play');
  });
});
