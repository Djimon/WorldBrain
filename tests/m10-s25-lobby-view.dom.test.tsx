// @vitest-environment jsdom
// M10 / #421 (S2): Lobby-View — DM full + explicit Session Start/Stop (= the connection),
// reduced player variant (roster + session status + own connection status). Integration
// through the REAL mount: render WorkspaceShell, enter play, open the lobby view, and
// assert against the REAL LobbyPanel (not an isolated render(<LobbyPanel/>)).
// See: https://github.com/Djimon/WorldBrain/issues/421
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stable db singleton (vi.hoisted) — a fresh object per render would change the
// host-transport effect's `database` dep every render → infinite re-render.
const { db } = vi.hoisted(() => ({
  db: { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) },
}));

// Capture the player transport's message listeners so the test can push a `roster`
// broadcast into the joined player's lobby.
const { playerListeners, broadcastRosterSpy, getPlayContextMock } = vi.hoisted(() => ({
  playerListeners: [] as ((msg: unknown) => void)[],
  broadcastRosterSpy: vi.fn().mockResolvedValue(undefined),
  getPlayContextMock: vi.fn(() => null as null | { campaignId: string; role: 'dm' | 'player' }),
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

// --- LobbyPanel service deps (real LobbyPanel renders) -----------------------------
vi.mock('../src/services/player-membership-service', () => ({
  listCampaignPlayers: vi.fn().mockResolvedValue([]),
  kick: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/session-identity-service', () => ({
  generateInviteCode: vi.fn().mockResolvedValue('ABCD-EFGH'),
  getActiveInviteCode: vi.fn().mockResolvedValue('ABCD-EFGH'),
}));
vi.mock('../src/services/app-id-service', () => ({ currentAppId: vi.fn().mockResolvedValue('app-xyz') }));
vi.mock('../src/services/player-groups-service', () => ({
  listGroups: vi.fn().mockResolvedValue([]),
  addMember: vi.fn().mockResolvedValue(undefined),
  removeMember: vi.fn().mockResolvedValue(undefined),
}));

// --- presence feed + host attaches: isolate the lobby from the sync machinery -------
vi.mock('../src/services/host-presence-sync', () => ({ broadcastRoster: broadcastRosterSpy }));
vi.mock('../src/services/player-content-filter-service', () => ({ attachVisibilityBroadcaster: vi.fn(() => () => {}) }));
vi.mock('../src/services/host-join-sync', () => ({ attachHostJoinSync: vi.fn() }));
vi.mock('../src/services/client-store-transport-bridge', () => ({ attachClientStoreToTransport: vi.fn(() => () => {}) }));
vi.mock('../src/services/host-token-sync', () => ({ attachHostTokenSync: vi.fn() }));
vi.mock('../src/services/presented-map-push', () => ({ pushPresentedMapSnapshot: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../src/services/play-context-store', () => ({
  getPlayContext: getPlayContextMock,
  setPlayContext: vi.fn(),
  clearPlayContext: vi.fn(),
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
  listCampaigns: vi.fn().mockResolvedValue([{ id: 'camp-1', title: 'Camp One' }]),
  createCampaign: vi.fn().mockResolvedValue({ id: 'camp-1', title: 'Camp One' }),
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
vi.mock('../src/ui/SessionTimeBar', () => ({ SessionTimeBar: stubComponent('SessionTimeBar') }));
vi.mock('../src/ui/SessionTimeControls', () => ({ SessionTimeControls: stubComponent('SessionTimeControls') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/FocusDropIn', () => ({ FocusDropIn: stubComponent('FocusDropIn') }));
vi.mock('../src/ui/PlaySettingsPanel', () => ({ PlaySettingsPanel: stubComponent('PlaySettingsPanel') }));
vi.mock('../src/ui/SettingsPanel', () => ({ SettingsPanel: stubComponent('SettingsPanel') }));

// Player join is driven directly: the stub calls onJoined on mount with a controllable
// transport whose message listeners the test captures (to push a `roster` broadcast).
vi.mock('../src/ui/PlayerJoinView', () => ({
  PlayerJoinView: ({ onJoined }: { onJoined: (a: { playerId: string; displayName: string; transport: unknown }) => void }) => {
    React.useEffect(() => {
      const transport = {
        onMessage: (cb: (msg: unknown) => void) => { playerListeners.push(cb); return () => {}; },
        send: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        attachSignaling: vi.fn().mockResolvedValue(undefined),
      };
      void onJoined({ playerId: 'p-1', displayName: 'Alice', transport });
    }, [onJoined]);
    return React.createElement('div', { 'data-testid': 'stub-PlayerJoinView' });
  },
}));

// Real primitives are NOT mocked here — the real LobbyPanel renders through the real
// design-system primitives (Button/Field/ListSurface/Panel/StatusChip).

afterEach(() => { cleanup(); playerListeners.length = 0; });
beforeEach(() => { getPlayContextMock.mockReturnValue(null); broadcastRosterSpy.mockClear(); });

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}

const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
const sidebar = () => document.querySelector('nav.workspace-shell__sidebar') as HTMLElement;

/** edit → Spielen (remembered DM context, no dialog) → lobby view (default). */
async function enterDmLobby() {
  getPlayContextMock.mockReturnValue({ campaignId: 'camp-1', role: 'dm' });
  const Shell = await getShell();
  render(React.createElement(Shell));
  await act(async () => { fireEvent.click(playSeg()); });
  await waitFor(() => expect(screen.getByRole('region', { name: 'Lobby' })).toBeTruthy());
}

/** edit → Spielen (remembered player context) → auto-join → reduced player lobby. */
async function enterPlayerLobby() {
  getPlayContextMock.mockReturnValue({ campaignId: 'camp-1', role: 'player' });
  const Shell = await getShell();
  render(React.createElement(Shell));
  await act(async () => { fireEvent.click(playSeg()); });
  // The join stub calls onJoined on mount → playerContext set → the reduced player
  // lobby renders (PlayerJoinView is transient and already unmounted by now).
  await waitFor(() => expect(screen.getByRole('region', { name: 'Lobby' })).toBeTruthy());
}

describe('#421 (S2) DM lobby — session Start/Stop + invite gating', () => {
  it('DM lobby shows the Session Start control and status "aus" before start', async () => {
    await enterDmLobby();
    expect(screen.getByRole('button', { name: 'Session starten' })).toBeTruthy();
    expect(screen.getByText('aus')).toBeTruthy();
  });

  it('the invite code is inactive before start (copy disabled + inactive hint)', async () => {
    await enterDmLobby();
    expect((screen.getByRole('button', { name: 'Code kopieren' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Der Code ist erst nach dem Start der Session gültig.')).toBeTruthy();
  });

  it('pressing Start opens the session: status "läuft", Stop control, invite active, roster broadcast', async () => {
    await enterDmLobby();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Session starten' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session stoppen' })).toBeTruthy());
    expect(screen.getByText('läuft')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Code kopieren' }) as HTMLButtonElement).disabled).toBe(false);
    // Start arms the host transport effect → initial roster broadcast (live:true).
    await waitFor(() => expect(broadcastRosterSpy).toHaveBeenCalledWith(expect.objectContaining({ live: true })));
  });

  it('DM lobby carries the roster section', async () => {
    await enterDmLobby();
    expect(screen.getByText('Verbundene Spieler')).toBeTruthy();
  });
});

describe('#421 (S2) reduced player lobby — roster + status, no DM controls', () => {
  it('player lobby shows session + connection status and the roster section, but no invite/kick', async () => {
    await enterPlayerLobby();
    expect(screen.getByText('Session:')).toBeTruthy();
    expect(screen.getByText('Verbindung:')).toBeTruthy();
    expect(screen.getByText('Verbundene Spieler')).toBeTruthy();
    // reduced: no invite copy control, no Session Start/Stop, no Kick.
    expect(screen.queryByRole('button', { name: 'Code kopieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Session starten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kick' })).toBeNull();
  });

  it('a host roster broadcast populates the player roster + session status', async () => {
    await enterPlayerLobby();
    expect(playerListeners.length).toBeGreaterThan(0);
    await act(async () => {
      for (const cb of playerListeners) {
        cb({ type: 'roster', token: 'system-dm', payload: { players: [{ playerId: 'p-1', displayName: 'Alice' }], live: true } });
      }
    });
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    expect(screen.getByText('läuft')).toBeTruthy();
  });
});
