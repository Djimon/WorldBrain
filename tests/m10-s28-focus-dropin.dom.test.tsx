// @vitest-environment jsdom
// M10 / #426 (S7): the opt-in focus drop-in + the new FloatingCard primitive.
//
// Two suites:
//  1) FloatingCard primitive (isolated, REAL): fixed corner-anchored floating card,
//     optional pulse, renders as a real <button> when given onClick.
//  2) FocusDropIn integration through the REAL WorkspaceShell mount (player role):
//     the drop-in appears when the DM presents a focus (a map in the player's store),
//     STAYS visible across sidebar-view switches, click jumps to the focus view, and
//     it disappears once the player is on the focus view. The DM never gets it.
// See: https://github.com/Djimon/WorldBrain/issues/426
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloatingCard } from '../src/ui/primitives';

// ── Suite 1: FloatingCard primitive (no mocks needed) ──────────────────────────
describe('#426 (S7) FloatingCard primitive', () => {
  afterEach(cleanup);

  it('renders as a real <button> with onClick, default bottom-right, pulse flag', () => {
    const onClick = vi.fn();
    render(React.createElement(FloatingCard, { onClick, pulse: true, 'aria-label': 'hint' }, 'x'));
    const btn = screen.getByRole('button', { name: 'hint' });
    expect(btn.className).toContain('ui-floating-card');
    expect(btn.getAttribute('data-corner')).toBe('bottom-right');
    expect(btn.getAttribute('data-pulse')).toBe(''); // present (boolean attr)
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('honours the corner prop and omits the pulse attribute when off', () => {
    render(React.createElement(FloatingCard, { onClick: vi.fn(), corner: 'top-left', 'aria-label': 'c' }, 'x'));
    const btn = screen.getByRole('button', { name: 'c' });
    expect(btn.getAttribute('data-corner')).toBe('top-left');
    expect(btn.getAttribute('data-pulse')).toBeNull();
  });

  it('renders as a non-interactive container when no onClick is given', () => {
    render(React.createElement(FloatingCard, { 'aria-label': 'static' }, 'y'));
    expect(screen.queryByRole('button')).toBeNull();
    const el = screen.getByLabelText('static');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('ui-floating-card');
  });
});

// ── Suite 2: FocusDropIn via the real WorkspaceShell mount ─────────────────────
// Stable db singleton (vi.hoisted): a fresh object per render would change the
// host-transport effect's `database` dep every render → infinite re-render (OOM).
const { db } = vi.hoisted(() => ({
  db: { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) },
}));

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
vi.mock('../src/services/campaign-service', () => ({
  listCampaigns: vi.fn().mockResolvedValue([{ id: 'camp-1', title: 'Test Campaign' }]),
  createCampaign: vi.fn().mockResolvedValue({ id: 'camp-1', title: 'Test Campaign' }),
}));
vi.mock('../src/services/calendar-service', () => ({
  listCalendars: vi.fn().mockResolvedValue([]),
  setActiveCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
  loadActiveCalendar: vi.fn().mockResolvedValue(null),
}));
vi.mock('../src/services/era-service', () => ({ listEras: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/services/session-time-service', () => ({
  getSessionNow: vi.fn().mockResolvedValue({ day: 0 }),
  advanceTime: vi.fn().mockResolvedValue(undefined),
  setSessionNow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/session-time-of-day-service', () => ({
  getTimeOfDay: vi.fn().mockResolvedValue({ mode: 'realtime', clockFormat: '24h', minuteOfDay: 480, phases: ['p'], phaseIndex: 0 }),
}));
vi.mock('../src/services/play-context-store', () => ({
  getPlayContext: vi.fn().mockReturnValue(null),
  setPlayContext: vi.fn(),
  clearPlayContext: vi.fn(),
}));
vi.mock('../src/services/event-entity-service', () => ({ createEventEntity: vi.fn(), createCampaignEventEntity: vi.fn() }));
vi.mock('../src/services/map-layer-service', () => ({ importImageLayer: vi.fn(), createFogLayer: vi.fn() }));

// The player's transport-fed store — a presented map is in it (DM focus active).
vi.mock('../src/services/play-client-store', () => {
  const listeners = new Set<() => void>();
  const store = {
    list: (kind: string) => (kind === 'map'
      ? [{ kind: 'map', id: 'm1', data: { title: 'Waldkarte', image_url: '' } }]
      : []),
    get: () => null,
    ownCharacter: () => null,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    applySnapshot: () => {},
    applyDelta: () => {},
    handleSnapshot: () => {},
    clear: () => {},
    isOffline: () => false,
  };
  return { createPlayClientStore: () => store };
});

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
vi.mock('../src/ui/LobbyPanel', () => ({ LobbyPanel: stubComponent('LobbyPanel') }));
// #422 (S3): the combatlog view is now the real CombatLogView — stub it as a play child.
vi.mock('../src/ui/CombatLogView', () => ({ CombatLogView: stubComponent('CombatLogView') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlaySettingsPanel', () => ({ PlaySettingsPanel: stubComponent('PlaySettingsPanel') }));
vi.mock('../src/ui/SettingsPanel', () => ({ SettingsPanel: stubComponent('SettingsPanel') }));
vi.mock('../src/ui/SessionTimeBar', () => ({ SessionTimeBar: stubComponent('SessionTimeBar') }));
vi.mock('../src/ui/SessionTimeControls', () => ({ SessionTimeControls: stubComponent('SessionTimeControls') }));
// FocusDropIn + primitives are REAL here.
vi.mock('../src/ui/PlayerJoinView', () => ({
  PlayerJoinView: ({ onJoined }: { onJoined: (a: { playerId: string; displayName: string; transport: null }) => void | Promise<void> }) => {
    React.useEffect(() => { void onJoined({ playerId: 'p1', displayName: 'Alice', transport: null }); }, [onJoined]);
    return React.createElement('div', { 'data-testid': 'stub-PlayerJoinView' });
  },
}));

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}

const sidebar = () => document.querySelector('nav.workspace-shell__sidebar') as HTMLElement;
const dropIn = () => screen.queryByRole('button', { name: 'focus.dropInLabel' });

async function enterPlayerPlay() {
  const Shell = await getShell();
  render(React.createElement(Shell));
  fireEvent.click(screen.getByRole('button', { name: 'Spielen' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Als Player/i })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Als Player/i }));
  // #421 (S2): the player lobby now renders the reduced LobbyPanel (role='player'),
  // not the old placeholder — LobbyPanel is stubbed here, so the landmark is its stub.
  await waitFor(() => expect(screen.getByTestId('stub-LobbyPanel')).toBeTruthy());
}

async function enterDmPlay() {
  const Shell = await getShell();
  render(React.createElement(Shell));
  fireEvent.click(screen.getByRole('button', { name: 'Spielen' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Als DM/i })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Als DM/i }));
  await waitFor(() => expect(screen.getByTestId('stub-LobbyPanel')).toBeTruthy());
}

describe('#426 (S7) focus drop-in — player, view-independent, opt-in', () => {
  afterEach(cleanup);

  it('appears for the player when the DM presents a focus (map in the store)', async () => {
    await enterPlayerPlay();
    await waitFor(() => expect(dropIn()).not.toBeNull());
  });

  it('stays visible when the player switches the active sidebar view', async () => {
    await enterPlayerPlay();
    await waitFor(() => expect(dropIn()).not.toBeNull());
    fireEvent.click(sidebar().querySelector('[data-area="combatlog"]') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('stub-CombatLogView')).toBeTruthy());
    expect(dropIn()).not.toBeNull(); // view-independent
  });

  it('disappears once the player navigates to the focus view themselves', async () => {
    await enterPlayerPlay();
    await waitFor(() => expect(dropIn()).not.toBeNull());
    fireEvent.click(sidebar().querySelector('[data-area="maps"]') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('stub-PlayCockpitMap')).toBeTruthy());
    expect(dropIn()).toBeNull(); // player is on the focus view
  });

  it('click on the drop-in jumps the player to the focus (maps) view', async () => {
    await enterPlayerPlay();
    await waitFor(() => expect(dropIn()).not.toBeNull());
    fireEvent.click(dropIn() as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('stub-PlayCockpitMap')).toBeTruthy());
    expect(dropIn()).toBeNull(); // jumped to the focus view → hint gone
  });

  it('never auto-switches the player view (still on the lobby after focus appears)', async () => {
    await enterPlayerPlay();
    await waitFor(() => expect(dropIn()).not.toBeNull());
    // The player stays on the lobby — the focus does NOT swap their view.
    expect(screen.getByTestId('stub-LobbyPanel')).toBeTruthy();
    expect(screen.queryByTestId('stub-PlayCockpitMap')).toBeNull();
  });

  it('the DM does NOT get the drop-in', async () => {
    await enterDmPlay();
    expect(dropIn()).toBeNull();
  });
});
