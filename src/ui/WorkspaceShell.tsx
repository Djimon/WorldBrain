import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../services/DatabaseContext';
import { listEntityTypes } from '../services/plugin-entity-service';
import { listViews } from '../services/saved-views-service';
import type { SavedViewRow } from '../services/saved-views-service';
import { feature, isGatedFeature } from '../config/features';
import { EntityMasterDetail } from './EntityMasterDetail';
import { EntityDetailView } from './EntityDetailView';
import { GlobalSearch } from './GlobalSearch';
import { CalendarWizard } from './CalendarWizard';
import { listCalendars, setActiveCalendar as persistActiveCalendar, deleteCalendar } from '../services/calendar-service';
import { formatCalendarDate } from '../../core_data/calendar-schema';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarLinkPanel } from './CalendarLinkPanel';
import { createEventEntity, createCampaignEventEntity } from '../services/event-entity-service';
import { SettingsPanel } from './SettingsPanel';
import { PlaySettingsPanel } from './PlaySettingsPanel';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { applyThemeVars } from '../theme';
import { Button, Panel, Segmented, StatusChip } from './primitives';
import { AppModeContext, type AppMode } from './AppModeContext';
// #432: the play-session transport/sync/campaign machinery moved into usePlaySession —
// the shell no longer imports it directly. Only getPlayContext stays (mode toggle reads it).
import { getPlayContext } from '../services/play-context-store';
// #420 (S1): the play "cockpit" (PlayModeView) is dissolved — its content now lives
// in dedicated play-sidebar views (lobby/combatlog/spotlight/maps) rendered by
// renderArea(). The lobby view reuses the existing LobbyPanel; #425 (S6) splits the
// session time into a display-only persistent strip (SessionTimeBar) + the DM's
// separate control panel (SessionTimeControls, mounted in the lobby).
import { LobbyPanel } from './LobbyPanel';
import { CombatLogView } from './CombatLogView';
import { SessionTimeControls } from './SessionTimeControls';
// #432: play-session orchestration + the two play-surface components extracted from
// this shell. renderArea() + the mode toggle stay here; the session state/effects/actions
// live in the hook, the role-select + play surface in their own components.
import { usePlaySession } from './hooks/usePlaySession';
import { RoleSelectPanel } from './RoleSelectPanel';
import { PlaySurface } from './PlaySurface';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { join } from '@tauri-apps/api/path';

const SOUNDBOARD_WINDOW_LABEL = 'audio-soundboard';

// pre-release S2 (#404): cut-able features are reached via dynamic import(), gated by
// the __FEATURE_<ID>__ compile constant read DIRECTLY here (not via feature()), because
// only a directly-inlined constant lets Rollup fold the dead branch and drop the
// import() chunk — a release build with the flag off tree-shakes the feature's code AND
// its libraries out of dist/. import.meta.env.DEV keeps every feature in the dev run.
// See src/config/features.ts + features.json.
const ChronicleView = import.meta.env.DEV || __FEATURE_CHRONICLE__
  ? lazy(() => import('./ChronicleView').then((m) => ({ default: m.ChronicleView })))
  : null;
const CardList = import.meta.env.DEV || __FEATURE_CARDS__
  ? lazy(() => import('./CardList').then((m) => ({ default: m.CardList })))
  : null;
const CardCreationFlow = import.meta.env.DEV || __FEATURE_CARDS__
  ? lazy(() => import('./CardCreationFlow').then((m) => ({ default: m.CardCreationFlow })))
  : null;
const PrintSheetComposer = import.meta.env.DEV || __FEATURE_CARDS__
  ? lazy(() => import('./PrintSheetComposer').then((m) => ({ default: m.PrintSheetComposer })))
  : null;
const PluginManager = import.meta.env.DEV || __FEATURE_PLUGINS__
  ? lazy(() => import('./PluginManager').then((m) => ({ default: m.PluginManager })))
  : null;
const RulesArea = import.meta.env.DEV || __FEATURE_RULES__
  ? lazy(() => import('./RulesArea').then((m) => ({ default: m.RulesArea })))
  : null;
const GlobalGraphView = import.meta.env.DEV || __FEATURE_GRAPH__
  ? lazy(() => import('./GlobalGraphView').then((m) => ({ default: m.GlobalGraphView })))
  : null;
const MapsArea = import.meta.env.DEV || __FEATURE_MAPS__
  ? lazy(() => import('./MapsArea').then((m) => ({ default: m.MapsArea })))
  : null;
// #420 (S1): in play mode the maps area shows the presentation map (PlayCockpitMap),
// not the edit MapsArea — same feature('maps') gate + lazy chunk (moved here from the
// removed PlayModeView so the play maps view can mount it directly).
const PlayCockpitMap = import.meta.env.DEV || __FEATURE_MAPS__
  ? lazy(() => import('./PlayCockpitMap').then((m) => ({ default: m.PlayCockpitMap })))
  : null;

// #432: exported so usePlaySession (which drives setActiveArea / lastAreaByMode) shares
// the exact area union. Type-only import → no runtime cycle with WorkspaceShell.
export type Area =
  | 'entities'
  | 'search'
  | 'maps'
  | 'calendar'
  | 'lobby'
  | 'combatlog'
  | 'spotlight'
  | 'chronicle'
  | 'cards'
  | 'plugins'
  | 'rules'
  | 'audio'
  | 'graph'
  | 'project'
  | 'play-settings';

interface CalendarRow {
  id: string;
  title: string;
  year_length_days: number;
  months: { name: string; days: number }[];
  week: string[];
  epoch_anchor_day: number;
  start_year: number;
  start_month: number;
  start_day: number;
}

interface Props {
  projectId?: string;
  projectTitle?: string;
  projectDir?: string;
  snapshotsDir?: string;
  onProjectClose?: () => void;
  onOpenProject?: (projectId: string) => void;
  onProjectRenamed?: (title: string) => void;
  activePanel?: Area;
}

const AREAS: { id: Area; icon: string }[] = [
  { id: 'entities', icon: '🗂' },
  { id: 'search',   icon: '🔍' },
  { id: 'maps',     icon: '🗺' },
  { id: 'calendar', icon: '📅' },
  // #420 (S1): the single play "session" area is dissolved into these play-sidebar views.
  { id: 'lobby',    icon: '👥' },
  { id: 'combatlog',icon: '⚔️' },
  { id: 'spotlight',icon: '🔦' },
  { id: 'chronicle',icon: '📜' },
  { id: 'cards',    icon: '🃏' },
  { id: 'plugins',  icon: '🔌' },
  { id: 'rules',    icon: '📖' },
  { id: 'audio',    icon: '🎧' },
  { id: 'graph',    icon: '🌌' },
  { id: 'project',  icon: '⚙' },
  // #390: Play settings — only visible in play mode (campaign/role/leave).
  { id: 'play-settings', icon: '⚙' },
];

// M10-S22 (#342 / D25): fixed play subset — not a config point.
// #390: play-settings extends the subset (play-scoped settings area).
const PLAY_AREAS: Area[] = ['entities', 'search', 'maps', 'calendar', 'lobby', 'combatlog', 'spotlight', 'play-settings'];

const CORE_ENTITY_TYPES = [
  'Character', 'Location', 'Faction', 'Item',
  'Quest', 'Event', 'Scene', 'Rule', 'Resource', 'Culture', 'Lore',
];

export function WorkspaceShell({ projectId = '', projectTitle, projectDir, snapshotsDir, onProjectClose, onOpenProject, onProjectRenamed, activePanel }: Props) {
  const { t } = useTranslation('nav');
  const database = useDatabase();
  // M10-S22 (D25): app-mode shell. `edit` = full author workspace, `play` =
  // session view with a fixed play subset (reduced menu) + chosen role.
  const [mode, setMode] = useState<AppMode>('edit');
  const [activeArea, setActiveArea] = useState<Area>(activePanel ?? 'entities');
  // Remember the last active area PER mode, so toggling edit⇄play restores the view you
  // were on in that mode (instead of always dropping into the play cockpit, and instead of
  // edit trying to render a play-only area). In-session memory (per mounted project).
  const lastAreaByMode = useRef<{ edit: Area; play: Area }>({ edit: activePanel ?? 'entities', play: 'lobby' });

  // #432: play-session orchestration lives in usePlaySession (role/campaign, DM host
  // transport + sync attaches, DB-less player store + roster feed, enter/leave/switch).
  // Destructured with the SAME names the shared views + return already use → behaviour
  // unchanged. `mode`/`setMode` + the mode toggle stay here (they steer chrome + area set).
  const {
    sessionRole, activeSessionId, showRoleSelect, playerContext, playerStore,
    hostTransport, playerTransport, sessionLive, playerRoster, playerSessionLive,
    combatLogTick, availableCampaigns, selectedCampaignForPlay, newCampaignTitle,
    playerNeedsJoin,
    setSelectedCampaignForPlay, setNewCampaignTitle, setShowRoleSelect,
    enterPlay, openRoleSelect, exitPlay, pickRole, createAndPickCampaign,
    startSession, stopSession, rebroadcastRoster,
    switchPlayCampaign, switchPlayRole, leavePlaySession, handlePlayerJoined,
  } = usePlaySession({ database, projectId, mode, setMode, setActiveArea, lastAreaByMode });

  // #415: a DM in a live campaign creates campaign-owned events (override, no base write).
  // Outside that (edit mode / world author) events go straight to the world base.
  const calendarCampaignId = mode === 'play' && sessionRole === 'dm' && activeSessionId !== null ? activeSessionId : undefined;
  function createCalendarEvent(params: { title: string; start_day: number; event_kind: 'single' }): Promise<{ id: string }> {
    return calendarCampaignId
      ? createCampaignEventEntity(database, { campaignId: calendarCampaignId, ...params })
      : createEventEntity(database, params);
  }
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>();
  const [entityType, setEntityType] = useState<string | null>('Character');
  // #412: maps is a lazy, feature('maps')-gated area (MapsArea). Only selectedMapId
  // stays lifted here so the selection persists across area switches (#315); all
  // other maps state + handlers live in MapsArea.
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showCardCreation, setShowCardCreation] = useState(false);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [activeCalendar, setActiveCalendar] = useState<CalendarRow | null>(null);
  const [wizardCal, setWizardCal] = useState<CalendarRow | 'new' | null>(null);
  const [startSelId, setStartSelId] = useState('');
  const [deletePrompt, setDeletePrompt] = useState(false);
  /** Show the calendar picker/start view even though a calendar is active. */
  const [showPicker, setShowPicker] = useState(false);
  const [calendarList, setCalendarList] = useState<{ id: string; title: string; is_active: number }[]>([]);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  // #425 (S6): bumped by the DM's SessionTimeControls → the display bar re-reads.
  const [sessionTimeToken, setSessionTimeToken] = useState(0);
  // #292: entityId of the event being created/edited inline in the calendar
  // area (day-click) — NOT a navigation to the Entities area, same page.
  const [calendarEditingEventId, setCalendarEditingEventId] = useState<string | null>(null);
  // Only a FRESHLY-created event opens straight in edit mode (fill in details right away).
  // Clicking an existing event opens the overview (read view) — auto-edit there was intrusive.
  const [calendarEditingStartInEdit, setCalendarEditingStartInEdit] = useState(false);
  // Day clicked, not yet an entity — title required before createEventEntity.
  const [calendarNewDay, setCalendarNewDay] = useState<number | null>(null);
  const [calendarNewTitle, setCalendarNewTitle] = useState('');
  const [savedViews, setSavedViews] = useState<SavedViewRow[]>([]);
  // Detached audio-soundboard window (EPIC-024/D1) — one instance at a time;
  // the launcher button is disabled while it's open, re-enabled once closed.
  const [soundboardOpen, setSoundboardOpen] = useState(false);

  useEffect(() => {
    listViews(database).then(setSavedViews).catch(console.error);
  }, [database]);


  // The OS window can outlive a WorkspaceShell remount (e.g. project switch) —
  // check for it on mount so the launcher button reflects reality.
  useEffect(() => {
    let cancelled = false;
    WebviewWindow.getByLabel(SOUNDBOARD_WINDOW_LABEL)
      .then((win) => { if (!cancelled && win) setSoundboardOpen(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // #187: Ctrl+K / Cmd+K → search area
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setActiveArea('search');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleOpenSoundboard() {
    if (await WebviewWindow.getByLabel(SOUNDBOARD_WINDOW_LABEL)) return;
    // Native background matched to the current theme BEFORE content paints —
    // without this the window briefly shows its default white background
    // while the webview spins up, then again while style.css loads (visible
    // as a double flash, unlike the main window whose OS chrome is already
    // warm at app start).
    const isDark = (localStorage.getItem('theme') ?? 'dark') === 'dark';
    // The soundboard is a separate window/JS context with no state shared
    // with this React tree — the db path travels as a query param so it can
    // open its own connection to the SAME SQLite DB (EPIC-024/D1).
    const dir = projectDir ?? '';
    const dbPath = await join(dir, 'world.db');
    const win = new WebviewWindow(SOUNDBOARD_WINDOW_LABEL, {
      url: `index.html?db=${encodeURIComponent(dbPath)}&projectDir=${encodeURIComponent(dir)}#/audio-soundboard`,
      title: t('audioSoundboardWindowTitle', 'Audio-Soundboard'),
      backgroundColor: isDark ? '#15181b' : '#f2f3f5',
      // Board rows (8 clip buttons + mixer cluster) need more room than
      // Tauri's 800x600 default — roughly +40%, then +10% more per feedback.
      width: 1232,
      height: 840,
    });
    setSoundboardOpen(true);
    void win.once('tauri://destroyed', () => setSoundboardOpen(false));
    void win.once('tauri://error', () => setSoundboardOpen(false));
  }

  const pluginEntityTypes = listEntityTypes().map((t) => t.id);
  const allEntityTypes = [...CORE_ENTITY_TYPES, ...pluginEntityTypes.filter((t) => !CORE_ENTITY_TYPES.includes(t))];

  function navigateToEntity(entityId: string) {
    // Navigate the whole path, not just the leaf detail view: switch the type
    // list to the target's type, select it, and land in the entities area.
    // Type + id must be set in the SAME continuation (type first) so React
    // batches them into one render — otherwise the type-change effect fires
    // after the id and resets the selection to null.
    setActiveArea('entities');
    database.select<{ type: string }>('SELECT type FROM base_entities WHERE id = ?', [entityId])
      .then((rows) => {
        const type = rows[0]?.type;
        if (type) setEntityType(type);
        setSelectedEntityId(entityId);
      })
      .catch(console.error);
  }

  async function loadCalendarById(id: string): Promise<CalendarRow | null> {
    const rows = await database.select<{ id: string; title: string; year_length_days: number; months_json: string; week_json: string; epoch_anchor_day: number; start_year: number; start_month: number; start_day: number }>(
      'SELECT id, title, year_length_days, months_json, week_json, epoch_anchor_day, start_year, start_month, start_day FROM calendars WHERE id = ?', [id],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      year_length_days: row.year_length_days,
      months: JSON.parse(row.months_json ?? '[]') as { name: string; days: number }[],
      week: JSON.parse(row.week_json ?? '[]') as string[],
      epoch_anchor_day: row.epoch_anchor_day ?? 0,
      start_year: row.start_year ?? 1,
      start_month: row.start_month ?? 1,
      start_day: row.start_day ?? 1,
    };
  }

  // On mount, load ONLY an explicitly-active calendar. If none is active we
  // never auto-open the configurator — the start view (picker) is shown.
  useEffect(() => {
    if (!database) return;
    listCalendars(database).then((cals) => {
      setCalendarList(cals);
      if (cals.length === 0) return;
      const activeId = cals.find((c) => c.is_active)?.id;
      setStartSelId(activeId ?? cals[cals.length - 1].id);
      if (activeId) void loadCalendarById(activeId).then((cal) => { if (cal) setActiveCalendar(cal); }).catch(console.error);
    }).catch(console.error);
  }, [database]);

  // Keep the start-view selection valid: it is only seeded on mount, so after
  // create/delete it can point at a removed id (or stay empty) while the
  // <select> visually shows the first option — which made both buttons inert.
  useEffect(() => {
    if (calendarList.length === 0) { setStartSelId(''); return; }
    if (!calendarList.some((c) => c.id === startSelId)) setStartSelId(calendarList[0].id);
  }, [calendarList, startSelId]);

  function refreshCalendars() {
    if (!database) return;
    void listCalendars(database).then(setCalendarList).catch(console.error);
  }
  function activateCalendar(id: string) {
    if (!database || !id) return;
    void persistActiveCalendar(database, id)
      .then(() => loadCalendarById(id))
      .then((cal) => { if (cal) { setActiveCalendar(cal); setShowPicker(false); } })
      .then(refreshCalendars)
      .catch(console.error);
  }
  function editCalendarById(id: string) {
    if (!database || !id) return;
    void loadCalendarById(id).then((cal) => { if (cal) setWizardCal(cal); }).catch(console.error);
  }
  function removeActiveCalendar() {
    if (!database || !activeCalendar) return;
    void deleteCalendar(database, activeCalendar.id)
      .then(() => { setActiveCalendar(null); setDeletePrompt(false); setShowPicker(false); })
      .then(refreshCalendars)
      .catch(console.error);
  }

  // Leaving the calendar area closes any open editor / delete prompt / picker.
  useEffect(() => {
    if (activeArea !== 'calendar') { setWizardCal(null); setDeletePrompt(false); setShowPicker(false); }
  }, [activeArea]);

  // Keep the current mode's remembered area up to date on every area change, so a later
  // mode toggle can restore it. (The mode-switch handlers read lastAreaByMode.)
  useEffect(() => {
    lastAreaByMode.current[mode] = activeArea;
  }, [activeArea, mode]);


  function renderArea() {
    switch (activeArea) {
      case 'entities':
        return (
          <div className="workspace-area">
            <div className="workspace-area__sidebar">
              <h3>{t('typeLabel', { ns: 'entity' })}</h3>
              <ul>
                {allEntityTypes.map((typId) => (
                  <li key={typId}>
                    <button aria-pressed={entityType === typId} onClick={() => setEntityType(typId)}>
                      {t(`type.${typId.toLowerCase()}`, { ns: 'entity', defaultValue: typId })}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="workspace-area__main">
              <EntityMasterDetail
                database={database}
                initialType={entityType}
                selectedEntityId={selectedEntityId}
                onEntitySelect={setSelectedEntityId}
                onNavigateToEntity={navigateToEntity}
              />
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="workspace-area">
            <GlobalSearch database={database} onNavigate={navigateToEntity} />
            {savedViews.length > 0 && (
              <div>
                <h3>{t('savedViews')}</h3>
                <ul>
                  {savedViews.map((v) => (
                    <li key={v.id}>
                      <button onClick={() => {}}>{v.name}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'maps':
        // #420 (S1): in play mode the maps area shows the presentation map
        // (PlayCockpitMap: tokens/fog, DM control / player-presented view) — no more
        // duplicate "Map" tab. In edit mode it stays the full MapsArea. Both share the
        // feature('maps') gate; each lazy const is null when maps is released off.
        if (mode === 'play') {
          const campaignId = activeSessionId ?? '';
          return PlayCockpitMap ? (
            <Suspense fallback={null}>
              <PlayCockpitMap
                role={sessionRole === 'player' ? 'player' : 'dm'}
                campaignId={campaignId}
                database={sessionRole === 'player' ? undefined : database}
                store={playerStore ?? undefined}
                transport={(sessionRole === 'player' ? playerTransport : hostTransport) ?? undefined}
                playerId={playerContext?.playerId}
              />
            </Suspense>
          ) : null;
        }
        // pre-release S2-Folge (#412): lazy + feature-gated; MapViewer/pixi + layer/
        // sidebar/folder-tree + map services tree-shaken when maps released off.
        return MapsArea ? (
          <Suspense fallback={null}>
            <MapsArea
              database={database}
              projectId={projectId}
              projectDir={projectDir}
              selectedMapId={selectedMapId}
              onSelectMap={setSelectedMapId}
              onNavigateToEntity={navigateToEntity}
            />
          </Suspense>
        ) : null;

      // #420 (S1): the play "cockpit" is dissolved into these play-sidebar views. S1
      // delivers the wiring + mount points (placeholders allowed); the real content
      // comes from S2 (lobby #421), S3 (combatlog #422), S4 (spotlight #423). The DM
      // lobby reuses the existing LobbyPanel. #425 (S6): the persistent bar shows
      // date + time-of-day (display only); the DM OPERATES them from the separate
      // SessionTimeControls panel here — a change bumps the bar's refresh token.
      case 'lobby': {
        const campaignId = activeSessionId ?? '';
        if (sessionRole === 'dm' && campaignId !== '') {
          // #421: DM lobby — full + explicit Session Start/Stop; invite valid only live.
          return (
            <div className="workspace-area u-stack u-gap-3">
              <LobbyPanel
                database={database}
                campaignId={campaignId}
                sessionLive={sessionLive}
                onStartSession={startSession}
                onStopSession={stopSession}
                onRosterChanged={rebroadcastRoster}
              />
              <SessionTimeControls database={database} campaignId={campaignId}
                onChanged={() => { setSessionTimeToken((n) => n + 1); setCalendarRefreshToken((n) => n + 1); }} />
            </div>
          );
        }
        // #421: reduced player lobby — roster + session status + own connection status,
        // fed by the host `roster` broadcast. DB-less: no invite/kick/groups.
        if (sessionRole === 'player') {
          return (
            <div className="workspace-area">
              <LobbyPanel
                role="player"
                campaignId={campaignId}
                sessionLive={playerSessionLive}
                roster={playerRoster}
                isOffline={playerStore?.isOffline() ?? true}
              />
            </div>
          );
        }
        // No active campaign yet.
        return (
          <div className="workspace-area">
            <Panel className="u-stack u-gap-2">
              <h3>{t('lobby')}</h3>
              <p className="u-muted">{t('play.lobbyPlayerPlaceholder', { ns: 'multiplayer' })}</p>
            </Panel>
          </div>
        );
      }

      // #422 (S3): combat-log view — DM (DB + dice, posts broadcast to players) and
      // player (store-filtered log + dice via transport intent). Feature reachability is
      // handled by the sidebar `feature('combatlog')` filter (visibleAreas).
      case 'combatlog': {
        const campaignId = activeSessionId ?? '';
        return (
          <CombatLogView
            role={sessionRole === 'player' ? 'player' : 'dm'}
            campaignId={campaignId}
            database={sessionRole === 'player' ? undefined : database}
            store={sessionRole === 'player' ? (playerStore ?? undefined) : undefined}
            transport={(sessionRole === 'player' ? playerTransport : hostTransport) ?? undefined}
            playerId={playerContext?.playerId}
            actorDisplay={sessionRole === 'player' ? (playerContext?.displayName ?? 'Player') : 'DM'}
            refreshToken={combatLogTick}
          />
        );
      }

      // #423 (S4): spotlight (whiteboard) is not built for 0.1 — a clear "coming soon"
      // stub (mirrors the SettingsPanel `settings__soon` teaser: emoji + warning chip +
      // title + short teaser), built from Panel/StatusChip primitives.
      case 'spotlight':
        return (
          <div className="workspace-area">
            <Panel className="u-stack u-gap-2">
              <div className="u-row u-gap-2">
                <span aria-hidden="true">🔦</span>
                <StatusChip tone="warning">{t('soon', { ns: 'common' })}</StatusChip>
              </div>
              <h3>{t('cockpit.spotlightTitle', { ns: 'multiplayer' })}</h3>
              <p className="u-muted">{t('play.spotlightTeaser', { ns: 'multiplayer' })}</p>
            </Panel>
          </div>
        );

      case 'calendar':
        return (
          <div className="workspace-area workspace-area--column">
            {wizardCal !== null ? (
              <CalendarWizard
                database={database}
                initial={wizardCal !== 'new' ? {
                  id: wizardCal.id,
                  title: wizardCal.title,
                  months: wizardCal.months,
                  week: wizardCal.week,
                  start: { year: wizardCal.start_year, month: wizardCal.start_month, day: wizardCal.start_day },
                } : undefined}
                onCancel={() => setWizardCal(null)}
                onComplete={(id) => {
                  const wasNew = wizardCal === 'new';
                  setWizardCal(null);
                  if (!id || !database) return;
                  if (wasNew) { activateCalendar(id); return; }
                  if (activeCalendar?.id === id) void loadCalendarById(id).then((cal) => { if (cal) setActiveCalendar(cal); }).catch(console.error);
                  refreshCalendars();
                }}
              />
            ) : (activeCalendar && !showPicker) ? (
              <div className="workspace-shell__col">
                <div className="workspace-shell__cal-header">
                  <strong>{activeCalendar.title}</strong>
                  <span className="workspace-shell__cal-meta">{t('calMeta', { days: activeCalendar.year_length_days, months: activeCalendar.months.length, weekdays: activeCalendar.week.length })}</span>
                  {deletePrompt ? (
                    <span className="workspace-shell__cal-actions">
                      <span>{t('calDeleteConfirm', { title: activeCalendar.title })}</span>
                      <Button tone="danger" variant="outline" onClick={removeActiveCalendar}>{t('calDeleteYes')}</Button>
                      <Button onClick={() => setDeletePrompt(false)}>{t('cancel', { ns: 'common' })}</Button>
                    </span>
                  ) : (
                    <span className="workspace-shell__cal-actions">
                      <Button onClick={() => setShowPicker(true)}>{t('calPick')}</Button>
                      <Button onClick={() => setWizardCal(activeCalendar)}>{t('changeCalendar')}</Button>
                      <Button tone="danger" variant="outline" onClick={() => setDeletePrompt(true)}>{t('delete', { ns: 'common' })}</Button>
                    </span>
                  )}
                </div>
                <div className="workspace-shell__cal-body">
                  <CalendarMonthView
                    calendar={activeCalendar}
                    database={database}
                    onCreateEvent={(day) => {
                      // #292 follow-up: don't create an entity yet — a stray
                      // day-click would otherwise leave a permanent empty-title
                      // junk event. Ask for a title first; only createEventEntity
                      // once confirmed non-blank.
                      setCalendarNewDay(day);
                      setCalendarNewTitle('');
                    }}
                    onEventClick={(id) => { setCalendarEditingStartInEdit(false); setCalendarEditingEventId(id); }}
                    refreshToken={calendarRefreshToken}
                  />
                  {calendarNewDay !== null && (
                    <div className="cal-inline-event-editor">
                      <div className="cal-inline-event-editor__header">
                        <span>{t('calNewEvent', { date: formatCalendarDate(activeCalendar, calendarNewDay) })}</span>
                      </div>
                      <div className="cal-inline-event-editor__new-form">
                        <input
                          type="text"
                          aria-label={t('calEventTitle')}
                          placeholder={t('calEventTitle')}
                          autoFocus
                          value={calendarNewTitle}
                          onChange={(e) => setCalendarNewTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { setCalendarNewDay(null); return; }
                            if (e.key !== 'Enter' || !calendarNewTitle.trim()) return;
                            createCalendarEvent({ title: calendarNewTitle.trim(), start_day: calendarNewDay, event_kind: 'single' })
                              .then(({ id }) => {
                                setCalendarNewDay(null);
                                setCalendarRefreshToken((n) => n + 1);
                                setCalendarEditingStartInEdit(true);
                                setCalendarEditingEventId(id);
                              })
                              .catch(console.error);
                          }}
                        />
                        <Button
                          tone="accent"
                          disabled={!calendarNewTitle.trim()}
                          onClick={() => {
                            createCalendarEvent({ title: calendarNewTitle.trim(), start_day: calendarNewDay, event_kind: 'single' })
                              .then(({ id }) => {
                                setCalendarNewDay(null);
                                setCalendarRefreshToken((n) => n + 1);
                                setCalendarEditingStartInEdit(true);
                                setCalendarEditingEventId(id);
                              })
                              .catch(console.error);
                          }}
                        >
                          {t('create', { ns: 'common' })}
                        </Button>
                        <Button onClick={() => setCalendarNewDay(null)}>{t('cancel', { ns: 'common' })}</Button>
                      </div>
                    </div>
                  )}
                  {calendarEditingEventId && (
                    <div className="cal-inline-event-editor">
                      <div className="cal-inline-event-editor__header">
                        <span>{t('calEditEvent')}</span>
                        <Button
                          onClick={() => {
                            setCalendarEditingEventId(null);
                            setCalendarRefreshToken((n) => n + 1);
                          }}
                        >
                          {t('close', { ns: 'common' })}
                        </Button>
                      </div>
                      <EntityDetailView
                        entityId={calendarEditingEventId}
                        database={database}
                        onNavigateToEntity={navigateToEntity}
                        calendar={activeCalendar}
                        startInEditMode={calendarEditingStartInEdit}
                        onSaved={() => setCalendarRefreshToken((n) => n + 1)}
                        onDeleted={() => {
                          setCalendarEditingEventId(null);
                          setCalendarRefreshToken((n) => n + 1);
                        }}
                      />
                    </div>
                  )}
                  {calendarList.length > 1 && (
                    <CalendarLinkPanel
                      database={database}
                      active={activeCalendar}
                      calendars={calendarList}
                      loadCalendar={loadCalendarById}
                      onLinked={refreshCalendars}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="cal-start">
                <h2 className="cal-start__title">{t('calendar')}</h2>
                <div className="cal-start__row">
                  <select className="cal-form__select cal-start__select" aria-label={t('calSelectAria')}
                    value={startSelId} disabled={calendarList.length === 0}
                    onChange={(e) => setStartSelId(e.target.value)}>
                    {calendarList.length === 0
                      ? <option value="">{t('calNoneYet')}</option>
                      : calendarList.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <Button tone="accent" disabled={!startSelId} onClick={() => activateCalendar(startSelId)}>{t('calActivate')}</Button>
                  <Button disabled={!startSelId} onClick={() => editCalendarById(startSelId)}>{t('edit', { ns: 'common' })}</Button>
                </div>
                <Button className="cal-start__new" onClick={() => setWizardCal('new')}>{t('calCreateNew')}</Button>
                {activeCalendar && (
                  <Button className="cal-start__new" onClick={() => setShowPicker(false)}>{t('calBackToView')}</Button>
                )}
              </div>
            )}
          </div>
        );

      case 'chronicle':
        // pre-release S2 (#404): lazy + feature-gated (tree-shaken when released off).
        return ChronicleView ? (
          <div className="workspace-area">
            <Suspense fallback={null}><ChronicleView database={database} /></Suspense>
          </div>
        ) : null;

      case 'cards':
        if (showPrintSheet) {
          return (
            <div className="workspace-area">
              <button onClick={() => setShowPrintSheet(false)}>← {t('back', { ns: 'common' })}</button>
              {PrintSheetComposer && (
                <Suspense fallback={null}>
                  <PrintSheetComposer database={database} initialCards={selectedCardIds} />
                </Suspense>
              )}
            </div>
          );
        }
        if (showCardCreation) {
          return (
            <div className="workspace-area">
              {CardCreationFlow && (
                <Suspense fallback={null}>
                  <CardCreationFlow
                    database={database}
                    onComplete={(id) => {
                      setSelectedCardIds((prev) => [...prev, id]);
                      setShowCardCreation(false);
                    }}
                  />
                </Suspense>
              )}
            </div>
          );
        }
        return CardList ? (
          <div className="workspace-area">
            <div className="workspace-area__toolbar">
              <button onClick={() => setShowCardCreation(true)}>{t('cardNew')}</button>
              <button onClick={() => setShowPrintSheet(true)}>{t('cardPrint')}</button>
            </div>
            <Suspense fallback={null}><CardList database={database} /></Suspense>
          </div>
        ) : null;

      case 'plugins':
        return PluginManager ? (
          <div className="workspace-area">
            <Suspense fallback={null}><PluginManager /></Suspense>
          </div>
        ) : null;

      case 'rules':
        return RulesArea ? (
          <div className="workspace-area">
            <Suspense fallback={null}><RulesArea database={database} /></Suspense>
          </div>
        ) : null;

      case 'audio':
        // pre-release S2 (#404): feature-gated launcher; the soundboard window code
        // itself is lazy + gated in main.tsx (that is where audio tree-shakes out).
        return feature('audio') ? (
          <div className="workspace-area">
            <div className="workspace-area__main">
              <h2>{t('audio')}</h2>
              <Button
                tone="accent"
                onClick={() => void handleOpenSoundboard()}
                disabled={soundboardOpen}
              >
                {soundboardOpen ? t('audioSoundboardRunning', 'Audio-Player läuft bereits') : t('audioSoundboardStart', 'Audio-Player starten')}
              </Button>
            </div>
          </div>
        ) : null;

      case 'graph':
        // pre-release S2 (#404): lazy + feature-gated (sigma/pixi/graphology tree-shaken when off).
        return GlobalGraphView ? (
          <div className="workspace-area">
            <Suspense fallback={null}><GlobalGraphView database={database} onNavigate={navigateToEntity} /></Suspense>
          </div>
        ) : null;

      case 'project':
        return (
          <div className="workspace-area">
            <SettingsPanel
              projectId={projectId}
              projectTitle={projectTitle}
              projectDir={projectDir ?? ''}
              snapshotsDir={snapshotsDir ?? ''}
              onProjectClose={onProjectClose}
              onOpenProject={onOpenProject}
              onProjectRenamed={onProjectRenamed}
            />
          </div>
        );
      case 'play-settings':
        // #390 / play-settings UX sprint: play-scoped settings in the same sidebar+detail
        // shell as the edit side (its own component, mirroring SettingsPanel).
        return (
          <div className="workspace-area">
            <PlaySettingsPanel
              availableCampaigns={availableCampaigns}
              activeSessionId={activeSessionId}
              sessionRole={sessionRole === 'dm' || sessionRole === 'player' ? sessionRole : null}
              onSwitchCampaign={switchPlayCampaign}
              onSwitchRole={switchPlayRole}
              onLeave={leavePlaySession}
            />
          </div>
        );
    }
  }

  const activeAreaLabel = t(activeArea);
  const visibleAreas = (mode === 'play'
    ? AREAS.filter((a) => PLAY_AREAS.includes(a.id))
    : AREAS.filter((a) => a.id !== 'play-settings' && !(['lobby', 'combatlog', 'spotlight'] as Area[]).includes(a.id))) // #390 + #420: hide play-only areas in edit
    // pre-release S2 (#404): hide cut-able features when their release flag is off.
    .filter((a) => (isGatedFeature(a.id) ? feature(a.id) : true));

  // M10-S22 (D25) + #390: click on the mode toggle.
  // edit → if a play context is remembered, go DIRECTLY in (no dialog);
  //        otherwise open the "campaign + role" selection step.
  // play → return to edit immediately; the remembered context STAYS (fast way back).
  function handleModeToggle() {
    if (mode === 'edit') {
      const remembered = getPlayContext(projectId);
      if (remembered) {
        void enterPlay(remembered.campaignId, remembered.role);
      } else {
        openRoleSelect();
      }
    } else {
      setMode('edit');
      exitPlay(); // #432: reset session state (remembered context STAYS — fast way back)
      setActiveArea(lastAreaByMode.current.edit); // restore the last edit view
    }
  }

  const modeContextValue = { mode, sessionRole, activeSessionId };

  // M17-S07 (#389): brand strings from the registry (#381) — source for the
  // merged wordmark AND the OS window title. The mode part follows `mode`
  // (Decision 2: mode→brand, NEVER role→brand).
  const brandPlatform = t('brand.platform', { ns: 'common' });
  const brandModeMark = t(mode === 'play' ? 'brand.mode.play' : 'brand.mode.edit', { ns: 'common' });

  // M17-S03 (#382): mirror the active shell mode as a second axis (besides data-theme)
  // onto documentElement — the mode-accent tokens in tokens.css hang
  // off `:root[data-mode='…']`. So the accent switches red⟷amber without a reload.
  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
    // #388: with a per-mode user theme, reapply the (now different) mode accent
    // inline — for built-in themes the applier no-ops (CSS stays responsible).
    applyThemeVars();
  }, [mode]);

  // M17-S07 (#389): OS window title depends on the mode — "Worlds and Beyond – RealmForge"
  // (edit) or "Worlds and Beyond – Adventure Nexus" (play). In non-Tauri environments
  // (tests/browser) getCurrentWindow is not available → guarded; the title is
  // cosmetic, a failure must not disrupt the app.
  useEffect(() => {
    try {
      void WebviewWindow.getCurrent().setTitle(`${brandPlatform} – ${brandModeMark}`).catch(() => { /* cosmetic */ });
    } catch { /* not in Tauri */ }
  }, [brandPlatform, brandModeMark]);

  return (
    <AppModeContext.Provider value={modeContextValue}>
      <div className="workspace-shell">
        <nav className="workspace-shell__sidebar" aria-label={t('sidebarNavAria')}>
          {visibleAreas.map(({ id, icon }) => (
            <button
              key={id}
              data-area={id}
              aria-label={t(id)}
              aria-pressed={activeArea === id}
              onClick={() => setActiveArea(id)}
              title={t(id)}
            >
              {icon}
            </button>
          ))}
          <div className="workspace-shell__sidebar-spacer" />
          <button
            className="workspace-shell__close-btn"
            aria-label={t('closeProject')}
            title={t('closeProject')}
            onClick={onProjectClose}
          >
            ✕
          </button>
        </nav>
        <div className="workspace-shell__content">
          {/* M17-S03 (#382): header accent stripe — carries the mode color
              (prep red / live amber) from --mode-accent, purely decorative. */}
          <div className="workspace-shell__mode-stripe" aria-hidden="true" />
          <header className="workspace-shell__header">
            {/* M17-S07 (#389): ONE merged product wordmark "Beyond
                Worlds – RealmForge" (or "… – Adventure Nexus"). Uniform typography/
                base color; only the mode part carries the mode accent subtly
                (--mode-accent-text) — no second, different pill style. The mode
                part follows `mode` (Decision 2), strings from the registry (#381).
                Non-color mode indicator #1 (Decision 4) = the plain-text name. */}
            <div className="workspace-shell__identity" role="group"
              aria-label={t('modeIdentityAria', 'Produkt-Identität')}>
              <span className="workspace-shell__wordmark">{brandPlatform} – {brandModeMark}</span>
              {/* Live-mode lock — non-color mode indicator #2 (Decision 4). */}
              {mode === 'play' && (
                <StatusChip tone="warning" aria-label={t('modeLockedAria', 'Live-Modus (gesperrt)')}>
                  🔒
                </StatusChip>
              )}
            </div>
            {/* #389: project and area name are secondary — they must not overlay the
                identity (smaller/dimmed via shell.css). */}
            <span className="workspace-shell__project-name">{projectTitle ?? projectId}</span>
            <span className="workspace-shell__area-name">{activeAreaLabel}</span>
            <div className="workspace-shell__header-controls">
              {/* #413 (runtime HIDE, not tree-shaken): the play/multiplayer mode is
                  gated by feature('session'). session=false hides the edit↔play toggle
                  so the cockpit is unreachable (the session area is hidden generically
                  via visibleAreas). Code stays in the bundle by design (see features.ts). */}
              {feature('session') && (
                <Segmented
                  label={t('modeToggleLabel', 'Modus')}
                  value={mode}
                  onChange={(id) => { if (id !== mode) handleModeToggle(); }}
                  size="compact"
                  options={[
                    { id: 'edit', label: t('modeEdit', 'Bearbeiten') },
                    { id: 'play', label: t('modePlay', 'Spielen') },
                  ]}
                />
              )}
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>
          {showRoleSelect ? (
            <RoleSelectPanel
              availableCampaigns={availableCampaigns}
              selectedCampaignForPlay={selectedCampaignForPlay}
              onSelectCampaign={setSelectedCampaignForPlay}
              newCampaignTitle={newCampaignTitle}
              onNewCampaignTitleChange={setNewCampaignTitle}
              onCreateCampaign={() => void createAndPickCampaign()}
              onPickRole={(role) => void pickRole(role)}
              onCancel={() => setShowRoleSelect(false)}
            />
          ) : (
            // #432: PlaySurface owns the join gate + the view-independent play chrome
            // (session bar #425, focus drop-in #426); renderArea() STAYS in the shell and
            // is passed as children (never duplicated).
            <PlaySurface
              playerNeedsJoin={playerNeedsJoin}
              onLeave={leavePlaySession}
              onPlayerJoined={(result) => void handlePlayerJoined(result)}
              mode={mode}
              sessionRole={sessionRole}
              activeSessionId={activeSessionId}
              database={database}
              sessionTimeToken={sessionTimeToken}
              playerStore={playerStore}
              activeArea={activeArea}
              onFocusJump={() => setActiveArea('maps')}
            >
              {renderArea()}
            </PlaySurface>
          )}
        </div>
      </div>
    </AppModeContext.Provider>
  );
}
