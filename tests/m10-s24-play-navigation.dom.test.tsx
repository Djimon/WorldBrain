// @vitest-environment jsdom
// M10 / #420 (S1): Play-Navigation — the single "session" cockpit area is dissolved
// into dedicated play-sidebar views (lobby/combatlog/spotlight + maps=PlayCockpitMap).
// Integration through the REAL mount: render WorkspaceShell, toggle into play mode,
// switch sidebar views via the user path (not an isolated render of a leaf component).
// See: https://github.com/Djimon/WorldBrain/issues/420
import { existsSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_IDS } from '../src/config/features';

// ---------------------------------------------------------------------------
// Mocks — WorkspaceShell has ~30 imports; every one must be stubbed (parity with
// m10-s22). The i18n mock returns the key (or a provided default) so assertions can
// key off the stable i18n keys of the placeholder views.
// ---------------------------------------------------------------------------
// Stable db singleton (vi.hoisted): a fresh object per render would change the
// host-transport effect's `database` dep every render → infinite re-render (OOM).
const { db } = vi.hoisted(() => ({
  db: { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) },
}));

// Stub the WebRTC host transport so entering DM play does no real signaling/timers.
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string | Record<string, unknown>) => {
      if (d === undefined) return k;
      if (typeof d === 'string') return d;
      if (typeof d === 'object' && 'defaultValue' in d) return String(d.defaultValue);
      return k;
    },
    i18n: { language: 'de', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../src/services/DatabaseContext', () => ({
  useDatabase: () => db,
  DatabaseContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../src/services/plugin-entity-service', () => ({
  listEntityTypes: vi.fn().mockReturnValue([]),
  registerPluginEntityType: vi.fn(),
  getEntityType: vi.fn(),
  registerPluginRelationType: vi.fn(),
  getRelationTypeDefinition: vi.fn(),
  listPluginRelationTypes: vi.fn().mockReturnValue([]),
  flagOutdatedSchema: vi.fn(),
}));

vi.mock('../src/services/map-service', () => ({ listMaps: vi.fn().mockResolvedValue([]), importMapImage: vi.fn() }));
vi.mock('../src/services/saved-views-service', () => ({ listViews: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/services/rule-import-service', () => ({ importRules: vi.fn() }));
vi.mock('../src/services/rule-evaluations', () => ({
  detectMysteryBreakers: vi.fn().mockResolvedValue([]),
  analyzeRoleCoverage: vi.fn().mockResolvedValue([]),
  detectQuestBlockers: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/services/calendar-service', () => ({ listCalendars: vi.fn().mockResolvedValue([]), setActiveCalendar: vi.fn(), deleteCalendar: vi.fn() }));
vi.mock('../../core_data/calendar-schema', () => ({ formatCalendarDate: vi.fn().mockReturnValue('') }));
vi.mock('../src/services/event-entity-service', () => ({ createEventEntity: vi.fn(), createCampaignEventEntity: vi.fn() }));
vi.mock('../src/services/map-layer-service', () => ({ importImageLayer: vi.fn(), createFogLayer: vi.fn() }));
vi.mock('../src/services/campaign-service', () => ({
  listCampaigns: vi.fn().mockResolvedValue([]),
  createCampaign: vi.fn().mockResolvedValue({ id: 'camp-1', title: 'Default Campaign' }),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => {
  const WebviewWindow = vi.fn().mockImplementation(() => ({ once: vi.fn(), listen: vi.fn() }));
  (WebviewWindow as unknown as Record<string, unknown>).getByLabel = vi.fn().mockResolvedValue(null);
  (WebviewWindow as unknown as Record<string, unknown>).getCurrent = vi.fn().mockReturnValue({ setTitle: vi.fn().mockResolvedValue(undefined) });
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
// #420 (S1): the dissolved cockpit's content — stub the play-sidebar children.
vi.mock('../src/ui/LobbyPanel', () => ({ LobbyPanel: stubComponent('LobbyPanel') }));
vi.mock('../src/ui/SessionTimeControl', () => ({ SessionTimeControl: stubComponent('SessionTimeControl') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlayerJoinView', () => ({ PlayerJoinView: stubComponent('PlayerJoinView') }));
vi.mock('../src/ui/PlaySettingsPanel', () => ({ PlaySettingsPanel: stubComponent('PlaySettingsPanel') }));
vi.mock('../src/ui/SettingsPanel', () => ({ SettingsPanel: stubComponent('SettingsPanel') }));
vi.mock('../src/ui/primitives', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('button', props),
  Panel: (props: Record<string, unknown>) => React.createElement('div', props),
  Field: (props: Record<string, unknown>) => React.createElement('input', props),
  StatusChip: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('span', props, children),
  Segmented: ({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly { id: string; label: React.ReactNode }[];
    onChange: (id: string) => void;
  }) => React.createElement(
    'div',
    { role: 'group', 'aria-label': label },
    options.map((opt) => React.createElement(
      'button',
      { key: opt.id, 'aria-pressed': opt.id === value, onClick: () => onChange(opt.id) },
      opt.label,
    )),
  ),
}));

afterEach(cleanup);

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}

const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
const asDm = () => screen.getByRole('button', { name: /Als DM/i });
const sidebar = () => document.querySelector('nav.workspace-shell__sidebar') as HTMLElement;
const areaIds = () => [...sidebar().querySelectorAll('[data-area]')].map((el) => el.getAttribute('data-area'));

/** edit → Spielen → Als DM → land on the default play view (lobby). */
async function enterDmPlay() {
  const Shell = await getShell();
  render(React.createElement(Shell));
  fireEvent.click(playSeg());
  await waitFor(() => expect(asDm()).toBeTruthy());
  fireEvent.click(asDm());
  await waitFor(() => expect(screen.getByTestId('stub-LobbyPanel')).toBeTruthy());
}

describe('#420 (S1) play navigation — cockpit dissolved into sidebar views', () => {
  it('play sidebar shows the play areas in order, no "session" area', async () => {
    await enterDmPlay();
    expect(areaIds()).toEqual([
      'entities', 'search', 'maps', 'calendar', 'lobby', 'combatlog', 'spotlight', 'play-settings',
    ]);
    expect(sidebar().querySelector('[data-area="session"]')).toBeNull();
  });

  it('lobby/combatlog/spotlight carry the specified icons', async () => {
    await enterDmPlay();
    expect(sidebar().querySelector('[data-area="lobby"]')?.textContent).toContain('👥');
    expect(sidebar().querySelector('[data-area="combatlog"]')?.textContent).toContain('⚔');
    expect(sidebar().querySelector('[data-area="spotlight"]')?.textContent).toContain('🔦');
  });

  it('DM lands on the lobby view (LobbyPanel + SessionTimeControl mounted)', async () => {
    await enterDmPlay();
    expect(screen.getByTestId('stub-LobbyPanel')).toBeTruthy();
    expect(screen.getByTestId('stub-SessionTimeControl')).toBeTruthy();
  });

  it('switching to the combatlog view via the sidebar mounts the combatlog view', async () => {
    await enterDmPlay();
    fireEvent.click(sidebar().querySelector('[data-area="combatlog"]') as HTMLElement);
    await waitFor(() => expect(screen.getByText('play.combatlogPlaceholder')).toBeTruthy());
  });

  it('switching to the spotlight view via the sidebar mounts the spotlight view', async () => {
    await enterDmPlay();
    fireEvent.click(sidebar().querySelector('[data-area="spotlight"]') as HTMLElement);
    await waitFor(() => expect(screen.getByText('cockpit.spotlightStub')).toBeTruthy());
  });

  it('switching to the maps view mounts the presentation map (PlayCockpitMap), not the edit MapsArea', async () => {
    await enterDmPlay();
    fireEvent.click(sidebar().querySelector('[data-area="maps"]') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('stub-PlayCockpitMap')).toBeTruthy());
  });

  it('the cockpit tab/split components are deleted (no PlayModeView / SplitView)', () => {
    expect(existsSync('src/ui/PlayModeView.tsx')).toBe(false);
    expect(existsSync('src/ui/SplitView.tsx')).toBe(false);
  });

  it('combatlog + spotlight are gate-able feature ids', () => {
    expect(FEATURE_IDS).toContain('combatlog');
    expect(FEATURE_IDS).toContain('spotlight');
  });
});
