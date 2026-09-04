// @vitest-environment jsdom
// M10 / #422 (S3): Combatlog-View — DM (DB log + dice, posts broadcast to players) and
// player (store-filtered log + dice via transport intent). Integration through the REAL
// mount: render WorkspaceShell, enter play, open the combatlog view, assert against the
// REAL CombatLogView + DiceRollerWidget (not an isolated render).
// See: https://github.com/Djimon/WorldBrain/issues/422
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) },
}));

const { playerListeners, getPlayContextMock, combatSpies } = vi.hoisted(() => ({
  playerListeners: [] as ((msg: unknown) => void)[],
  getPlayContextMock: vi.fn(() => null as null | { campaignId: string; role: 'dm' | 'player' }),
  combatSpies: {
    sendRollIntent: vi.fn(),
    broadcastCombatEntry: vi.fn(),
    attachHostCombatSync: vi.fn(),
    replayCombatLog: vi.fn().mockResolvedValue(undefined),
  },
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

// --- combat-log domain: real CombatLogView/DiceRollerWidget render against these -----
vi.mock('../src/services/combat-log-service', () => ({
  listEntries: vi.fn().mockResolvedValue([
    { id: 'cl-1', campaign_id: 'camp-1', actor_display: 'DM', actor_player_id: null, text: 'DM: 1d20 = 15', visibility: 'all', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'cl-2', campaign_id: 'camp-1', actor_display: 'DM', actor_player_id: null, text: 'Secret roll', visibility: 'dm_only', created_at: '2026-01-01T00:01:00.000Z' },
  ]),
  postEntry: vi.fn().mockResolvedValue({ id: 'cl-new', campaign_id: 'camp-1', actor_display: 'DM', actor_player_id: null, text: 'DM: 1d20 = 20', visibility: 'all', created_at: '2026-01-01T00:02:00.000Z' }),
}));
vi.mock('../src/services/dice-roller-service', () => ({
  roll: vi.fn().mockResolvedValue({ dice: [20], modifier: 0, total: 20 }),
}));
vi.mock('../src/services/host-combat-log-sync', () => combatSpies);

// LobbyPanel service deps (real LobbyPanel renders — needed for the Start control).
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

// Isolate the host sync machinery — but keep the client-store bridge REAL so a broadcast
// combat_log delta actually populates the player store (the store-read path under test).
vi.mock('../src/services/host-presence-sync', () => ({ broadcastRoster: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/services/player-content-filter-service', () => ({ attachVisibilityBroadcaster: vi.fn(() => () => {}) }));
vi.mock('../src/services/host-join-sync', () => ({ attachHostJoinSync: vi.fn() }));
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

afterEach(() => { cleanup(); playerListeners.length = 0; });
beforeEach(() => {
  getPlayContextMock.mockReturnValue(null);
  combatSpies.sendRollIntent.mockClear();
  combatSpies.broadcastCombatEntry.mockClear();
});

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}

const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
const sidebar = () => document.querySelector('nav.workspace-shell__sidebar') as HTMLElement;
const gotoCombatlog = async () => {
  await act(async () => { fireEvent.click(sidebar().querySelector('[data-area="combatlog"]') as HTMLElement); });
  await waitFor(() => expect(screen.getByText('Kampflog')).toBeTruthy());
};

describe('#422 (S3) DM combatlog — DB log + dice + broadcast', () => {
  async function enterDm() {
    getPlayContextMock.mockReturnValue({ campaignId: 'camp-1', role: 'dm' });
    const Shell = await getShell();
    render(React.createElement(Shell));
    await act(async () => { fireEvent.click(playSeg()); });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Lobby' })).toBeTruthy());
  }

  it('shows the DB log (incl. dm_only marked "Nur DM") and the dice widget', async () => {
    await enterDm();
    await gotoCombatlog();
    expect(screen.getByText('DM: 1d20 = 15')).toBeTruthy();
    expect(screen.getByText('Secret roll')).toBeTruthy();
    // dm_only visibility marker — scoped to the log (the dice dropdown also has a "Nur DM" option).
    const logPanel = document.querySelector('.combat-log-view__log') as HTMLElement;
    expect(within(logPanel).getByText('Nur DM')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Würfeln' })).toBeTruthy();
  });

  it('a DM roll posts and broadcasts the entry to the players', async () => {
    await enterDm();
    // Start the session so the host transport exists (broadcast target).
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Session starten' })); });
    await gotoCombatlog();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Würfeln' })); });
    await waitFor(() => expect(combatSpies.broadcastCombatEntry).toHaveBeenCalled());
  });
});

describe('#422 (S3) player combatlog — store log + dice via intent', () => {
  async function enterPlayer() {
    getPlayContextMock.mockReturnValue({ campaignId: 'camp-1', role: 'player' });
    const Shell = await getShell();
    render(React.createElement(Shell));
    await act(async () => { fireEvent.click(playSeg()); });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Lobby' })).toBeTruthy());
  }

  it('shows the dice widget and rolling (all) sends a host intent, not a DB write', async () => {
    await enterPlayer();
    await gotoCombatlog();
    expect(screen.getByRole('button', { name: 'Würfeln' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Würfeln' })); });
    await waitFor(() => expect(combatSpies.sendRollIntent).toHaveBeenCalled());
  });

  it('a broadcast combat_log delta populates the player log from the store', async () => {
    await enterPlayer();
    await gotoCombatlog();
    expect(playerListeners.length).toBeGreaterThan(0);
    await act(async () => {
      for (const cb of playerListeners) {
        cb({ type: 'delta', token: 'system-dm', payload: {
          type: 'delta', campaignId: 'camp-1', op: 'add', kind: 'combat_log', id: 'cl-x',
          data: { actor_display: 'Bob', actor_player_id: 'p-2', text: 'Bob: 2d6 = 9', visibility: 'all', created_at: '2026-01-01T00:05:00.000Z' },
          serverTime: '2026-01-01T00:05:00.000Z',
        } });
      }
    });
    await waitFor(() => expect(screen.getByText('Bob: 2d6 = 9')).toBeTruthy());
  });
});
