// @vitest-environment jsdom
// M10 / #425 (S6): the persistent, view-INDEPENDENT session bar (date + time-of-day).
// Integration through the REAL mount: render WorkspaceShell, enter play mode, and
// assert the DISPLAY-ONLY strip renders OUTSIDE the per-view content — it stays
// visible when the active sidebar view changes and carries NO controls. The DM
// OPERATES day + time-of-day from the SEPARATE SessionTimeControls panel (in the
// lobby); a joined player sees neither that panel nor any control in the strip.
// SessionTimeBar + SessionTimeControls + primitives are REAL here (not stubbed) —
// only their leaf service deps are mocked. https://github.com/Djimon/WorldBrain/issues/425
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

// i18n: return the key (or a provided default) so assertions key off stable keys.
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
// One campaign present → the role-select auto-selects it (enables "Als Player").
vi.mock('../src/services/campaign-service', () => ({
  listCampaigns: vi.fn().mockResolvedValue([{ id: 'camp-1', title: 'Test Campaign' }]),
  createCampaign: vi.fn().mockResolvedValue({ id: 'camp-1', title: 'Test Campaign' }),
}));
// calendar-service: WorkspaceShell needs list/set/delete; the bar needs loadActiveCalendar.
vi.mock('../src/services/calendar-service', () => ({
  listCalendars: vi.fn().mockResolvedValue([]),
  setActiveCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
  loadActiveCalendar: vi.fn().mockResolvedValue({
    id: 'cal-1', title: 'C', year_length_days: 360,
    months: [{ name: 'Jan', days: 30 }], week: ['Mo'],
    epoch_anchor_day: 0, start_year: 1, start_month: 1, start_day: 1,
  }),
}));
vi.mock('../src/services/era-service', () => ({ listEras: vi.fn().mockResolvedValue([]) }));
// Session-now (day) + time-of-day (S5): canned reads, no-op writes.
vi.mock('../src/services/session-time-service', () => ({
  getSessionNow: vi.fn().mockResolvedValue({ day: 5 }),
  advanceTime: vi.fn().mockResolvedValue(undefined),
  setSessionNow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/session-time-of-day-service', () => ({
  getTimeOfDay: vi.fn().mockResolvedValue({
    mode: 'realtime', clockFormat: '24h', minuteOfDay: 480,
    phases: ['timeOfDay.phase.morning'], phaseIndex: 0,
  }),
  setTimeMode: vi.fn().mockResolvedValue(undefined),
  setClockFormat: vi.fn().mockResolvedValue(undefined),
  setRealtimeMinute: vi.fn().mockResolvedValue(undefined),
  advanceRealtime: vi.fn().mockResolvedValue(undefined),
  setPhaseIndex: vi.fn().mockResolvedValue(undefined),
  advancePhase: vi.fn().mockResolvedValue(undefined),
}));
// No remembered play context → every test starts fresh at the role-select step.
// (Without this, entering play in one test persists the context and later tests
// restore straight into play, skipping the role picker.)
vi.mock('../src/services/play-context-store', () => ({
  getPlayContext: vi.fn().mockReturnValue(null),
  setPlayContext: vi.fn(),
  clearPlayContext: vi.fn(),
}));
vi.mock('../src/services/event-entity-service', () => ({ createEventEntity: vi.fn(), createCampaignEventEntity: vi.fn() }));
vi.mock('../src/services/map-layer-service', () => ({ importImageLayer: vi.fn(), createFogLayer: vi.fn() }));

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
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlaySettingsPanel', () => ({ PlaySettingsPanel: stubComponent('PlaySettingsPanel') }));
vi.mock('../src/ui/SettingsPanel', () => ({ SettingsPanel: stubComponent('SettingsPanel') }));
// A joined player: auto-fire onJoined so the join gate clears and the bar mounts
// with the player-facing (display-only) props.
vi.mock('../src/ui/PlayerJoinView', () => ({
  PlayerJoinView: ({ onJoined }: { onJoined: (a: { playerId: string; displayName: string; transport: null }) => void | Promise<void> }) => {
    React.useEffect(() => { void onJoined({ playerId: 'p1', displayName: 'Alice', transport: null }); }, [onJoined]);
    return React.createElement('div', { 'data-testid': 'stub-PlayerJoinView' });
  },
}));
// NOTE: SessionTimeBar, SessionTimeControl, primitives and calendar-schema are REAL here.

afterEach(cleanup);

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}

const sidebar = () => document.querySelector('nav.workspace-shell__sidebar') as HTMLElement;
const bar = () => screen.getByRole('region', { name: 'sessionTime.barLabel' });

/** edit → Spielen → Als DM → land in DM play (lobby), bar mounted. */
async function enterDmPlay() {
  const Shell = await getShell();
  render(React.createElement(Shell));
  fireEvent.click(screen.getByRole('button', { name: 'Spielen' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Als DM/i })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Als DM/i }));
  await waitFor(() => expect(bar()).toBeTruthy());
}

/** edit → Spielen → Als Player → auto-join → land in player play, bar mounted. */
async function enterPlayerPlay() {
  const Shell = await getShell();
  render(React.createElement(Shell));
  fireEvent.click(screen.getByRole('button', { name: 'Spielen' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Als Player/i })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Als Player/i }));
  await waitFor(() => expect(bar()).toBeTruthy());
}

describe('#425 (S6) persistent session bar — date + time-of-day, view-independent', () => {
  it('DM: the bar renders date + time-of-day', async () => {
    await enterDmPlay();
    const b = bar();
    expect(within(b).getByText('sessionTime.dateLabel:')).toBeTruthy();
    expect(within(b).getByText('timeOfDay.label:')).toBeTruthy();
    // realtime 08:00 (minuteOfDay 480, 24h).
    await waitFor(() => expect(within(b).getByText('08:00')).toBeTruthy());
  });

  it('DM: the strip is display-only; the controls live in the SEPARATE lobby panel', async () => {
    await enterDmPlay();
    const b = bar();
    // The persistent strip carries NO controls.
    expect(within(b).queryByRole('button')).toBeNull();
    expect(within(b).queryByRole('region', { name: 'Session-Zeit' })).toBeNull();
    expect(within(b).queryByRole('group', { name: 'timeOfDay.modeLabel' })).toBeNull();
    // The DM's control panel (SessionTimeControls) is mounted OUTSIDE the strip:
    // day controls (SessionTimeControl — string-default i18n → German) + the S5
    // time-of-day setters (bar/panel t() without default → keys).
    expect(screen.getByRole('region', { name: 'Session-Zeit' })).toBeTruthy();
    expect(screen.getByText('+1 Tag')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'timeOfDay.modeLabel' })).toBeTruthy();
    expect(screen.getByText('timeOfDay.plusHour')).toBeTruthy();
  });

  it('the bar stays visible when the active sidebar view changes', async () => {
    await enterDmPlay();
    // Switch lobby → combatlog; the bar lives OUTSIDE renderArea() so it persists.
    fireEvent.click(sidebar().querySelector('[data-area="combatlog"]') as HTMLElement);
    await waitFor(() => expect(screen.getByText('play.combatlogPlaceholder')).toBeTruthy());
    expect(bar()).toBeTruthy();
    // And again lobby → spotlight.
    fireEvent.click(sidebar().querySelector('[data-area="spotlight"]') as HTMLElement);
    await waitFor(() => expect(screen.getByText('play.spotlightTeaser')).toBeTruthy());
    expect(bar()).toBeTruthy();
  });

  it('player: sees date + time-of-day but NO controls anywhere', async () => {
    await enterPlayerPlay();
    const b = bar();
    // Display present for the player too.
    expect(within(b).getByText('sessionTime.dateLabel:')).toBeTruthy();
    await waitFor(() => expect(within(b).getByText('08:00')).toBeTruthy());
    // No controls in the strip AND no DM control panel in the player's lobby.
    expect(within(b).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Session-Zeit' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'timeOfDay.modeLabel' })).toBeNull();
    expect(screen.queryByText('timeOfDay.plusHour')).toBeNull();
  });
});
