import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../services/DatabaseContext';
import { listEntityTypes } from '../services/plugin-entity-service';
import { listMaps, importMapImage } from '../services/map-service';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { copyMapAsset } from '../services/map-asset';
import type { MapRow } from '../services/map-service';
import { listViews } from '../services/saved-views-service';
import type { SavedViewRow } from '../services/saved-views-service';
import { importRules } from '../services/rule-import-service';
import { detectMysteryBreakers, analyzeRoleCoverage, detectQuestBlockers } from '../services/rule-evaluations';
import { EntityMasterDetail } from './EntityMasterDetail';
import { EntityDetailView } from './EntityDetailView';
import { GlobalSearch } from './GlobalSearch';
import { ChronicleView } from './ChronicleView';
import { CalendarWizard } from './CalendarWizard';
import { listCalendars, setActiveCalendar as persistActiveCalendar, deleteCalendar } from '../services/calendar-service';
import { formatCalendarDate } from '../../core_data/calendar-schema';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarLinkPanel } from './CalendarLinkPanel';
import { createEventEntity } from '../services/event-entity-service';
import { CardList } from './CardList';
import { CardCreationFlow } from './CardCreationFlow';
import { PrintSheetComposer } from './PrintSheetComposer';
import { PluginManager } from './PluginManager';
import { DmScreen, DmScreenSelector } from './DmScreen';
import { SettingsPanel } from './SettingsPanel';
import { MapViewer } from './MapViewer';
import { GlobalGraphView } from './GlobalGraphView';
import { LayerPanel } from './LayerPanel';
import { MapsSidebarTabs } from './MapsSidebarTabs';
import { MapFolderTree } from './MapFolderTree';
import { importImageLayer, createFogLayer } from '../services/map-layer-service';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { applyThemeVars } from '../theme';
import { Button, Field, Panel, Segmented, StatusChip } from './primitives';
import { AppModeContext, type AppMode, type SessionRole } from './AppModeContext';
import { WebRtcTransport } from '../services/webrtc-transport';
import { currentAppId } from '../services/app-id-service';
import { attachVisibilityBroadcaster } from '../services/player-content-filter-service';
import { attachHostTokenSync } from '../services/host-token-sync';
import { attachHostJoinSync } from '../services/host-join-sync';
import { attachClientStoreToTransport } from '../services/client-store-transport-bridge';
import { pushPresentedMapSnapshot } from '../services/presented-map-push';
import { createPlayClientStore, type PlayClientStoreImpl } from '../services/play-client-store';
import { listCampaigns, createCampaign, type Campaign } from '../services/campaign-service';
import { getPlayContext, setPlayContext, clearPlayContext } from '../services/play-context-store';
import { PlayModeView } from './PlayModeView';
import { PlayerJoinView } from './PlayerJoinView';
import { ModuleLibrary } from './ModuleLibrary';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { join } from '@tauri-apps/api/path';

const SOUNDBOARD_WINDOW_LABEL = 'audio-soundboard';

type Area =
  | 'entities'
  | 'search'
  | 'maps'
  | 'calendar'
  | 'session'
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
  activePanel?: Area;
}

const AREAS: { id: Area; icon: string }[] = [
  { id: 'entities', icon: '🗂' },
  { id: 'search',   icon: '🔍' },
  { id: 'maps',     icon: '🗺' },
  { id: 'calendar', icon: '📅' },
  { id: 'session',  icon: '🎲' },
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
const PLAY_AREAS: Area[] = ['entities', 'search', 'maps', 'calendar', 'session', 'play-settings'];

const CORE_ENTITY_TYPES = [
  'Character', 'Location', 'Faction', 'Item',
  'Quest', 'Event', 'Scene', 'Rule', 'Resource', 'Culture', 'Lore',
];

export function WorkspaceShell({ projectId = '', projectTitle, projectDir, snapshotsDir, onProjectClose, onOpenProject, activePanel }: Props) {
  const { t } = useTranslation('nav');
  const database = useDatabase();
  // M10-S22 (D25): app-mode shell. `edit` = full author workspace, `play` =
  // session view with a fixed play subset (reduced menu) + chosen role.
  const [mode, setMode] = useState<AppMode>('edit');
  const [sessionRole, setSessionRole] = useState<SessionRole>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  // M10-S05/S08: after the player join, token+playerId+displayName are fixed;
  // the play view then switches to PlayerCharacterSheet.
  const [playerContext, setPlayerContext] = useState<{ playerId: string; displayName: string } | null>(null);
  // M10-S14: the player's group IDs for the host-side group view (S09).
  const [playerGroupIds, setPlayerGroupIds] = useState<string[]>([]);
  // #374 D30 membrane: the client renders only from the store. Create lazily,
  // once the player context is fixed — the host would later push snapshot+delta
  // (transport wiring in R2/R3 follows).
  const [playerStore, setPlayerStore] = useState<PlayClientStoreImpl | null>(null);
  // M10-#386: the host transport is lifted into state so the play cockpit
  // (PlayModeView → MapViewer) can broadcast token movements through it.
  const [hostTransport, setHostTransport] = useState<WebRtcTransport | null>(null);
  // M10-#386 (variant A): the player transport bubbles up from the join flow
  // (PlayerJoinView) — the shell feeds the DB-less store with it (D29 feed)
  // and the player sends token movement intents through it.
  const [playerTransport, setPlayerTransport] = useState<WebRtcTransport | null>(null);
  // M10-S22 (follow-up): real campaign selection on play entry instead of the
  // projectId hack. Campaigns are loaded when the selection panel opens.
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignForPlay, setSelectedCampaignForPlay] = useState<string>('');
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [activeArea, setActiveArea] = useState<Area>(activePanel ?? 'entities');
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>();
  const [entityType, setEntityType] = useState<string | null>('Character');
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapRow[]>([]);
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
  // #292: entityId of the event being created/edited inline in the calendar
  // area (day-click) — NOT a navigation to the Entities area, same page.
  const [calendarEditingEventId, setCalendarEditingEventId] = useState<string | null>(null);
  // Day clicked, not yet an entity — title required before createEventEntity.
  const [calendarNewDay, setCalendarNewDay] = useState<number | null>(null);
  const [calendarNewTitle, setCalendarNewTitle] = useState('');
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [mapImporting, setMapImporting] = useState(false);
  // Resizable maps sidebar (same drag pattern as MapViewer's pin tree).
  const [mapsSidebarWidth, setMapsSidebarWidth] = useState(240);
  const [mapsSidebarCollapsed, setMapsSidebarCollapsed] = useState(false);
  // Bumped whenever layers change (add / opacity / visibility / reorder / fog
  // stroke) -> MapViewer and LayerPanel reload their layer list live, no remount
  // (view/zoom preserved; markers/grid/cells untouched).
  const [layerReloadKey, setLayerReloadKey] = useState(0);
  // Fog layer currently selected for painting (shared: LayerPanel selects it,
  // MapViewer paints it).
  const [editingFogLayerId, setEditingFogLayerId] = useState<string | null>(null);
  // Image layer currently in move mode (shared: LayerPanel selects, MapViewer drags).
  const [movingLayerId, setMovingLayerId] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedViewRow[]>([]);
  // Detached audio-soundboard window (EPIC-024/D1) — one instance at a time;
  // the launcher button is disabled while it's open, re-enabled once closed.
  const [soundboardOpen, setSoundboardOpen] = useState(false);

  useEffect(() => {
    listMaps(database).then(setMaps).catch(console.error);
  }, [database]);

  // Fog/move selections belong to one map — drop them when the map changes.
  useEffect(() => { setEditingFogLayerId(null); setMovingLayerId(null); }, [selectedMapId]);

  // #315: also drop them when leaving the maps area — selectedMapId stays
  // the same across an area switch, so the effect above alone doesn't fire,
  // and fog-paint mode would otherwise still be active on returning.
  useEffect(() => {
    if (activeArea !== 'maps') { setEditingFogLayerId(null); setMovingLayerId(null); }
  }, [activeArea]);

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

  async function handleMapImport() {
    const selected = await openDialog({ filters: [{ name: t('fileFilterImages'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], multiple: false });
    if (typeof selected !== 'string') return;
    setMapImporting(true);
    try {
      const title = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Karte';
      const result = await importMapImage(database, { srcPath: selected, title, projectDir: projectDir ?? '' });
      const updatedMaps = await listMaps(database);
      setMaps(updatedMaps);
      setSelectedMapId(result.id);
    } finally {
      setMapImporting(false);
    }
  }

  async function handleAddImageLayer() {
    if (!selectedMapId) return;
    const selected = await openDialog({ filters: [{ name: t('fileFilterImages'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], multiple: false });
    if (typeof selected !== 'string') return;
    const name = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Bild-Layer';
    await importImageLayer(database, { map_id: selectedMapId, srcPath: selected, projectDir: projectDir ?? '', name });
    setLayerReloadKey((n) => n + 1);
  }

  // Drag the splitter to resize the maps sidebar.
  function handleMapsSidebarResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = mapsSidebarWidth;
    const onMove = (ev: MouseEvent) => setMapsSidebarWidth(Math.max(180, Math.min(480, startW + (ev.clientX - startX))));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // #298: token art upload — opens the Tauri dialog, copies the image via the
  // shared asset flow, returns the asset id for the TokenEditor to store.
  async function handlePickTokenArt(): Promise<string | null> {
    const selected = await openDialog({ filters: [{ name: t('fileFilterImages'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], multiple: false });
    if (typeof selected !== 'string') return null;
    return copyMapAsset(selected, projectDir ?? '', `token-${crypto.randomUUID()}`);
  }

  async function handleAddFogLayer() {
    if (!selectedMapId) return;
    const { id } = await createFogLayer(database, { map_id: selectedMapId, name: 'Fog' });
    setEditingFogLayerId(id); // select the new fog layer for painting right away
    setLayerReloadKey((n) => n + 1);
  }

  function runEvaluation(kind: 'mystery' | 'role' | 'quest') {
    try {
      if (kind === 'mystery') {
        const result = detectMysteryBreakers({ quest: { id: '' }, party: [] });
        setEvalResult(JSON.stringify(result, null, 2));
      } else if (kind === 'role') {
        const result = analyzeRoleCoverage({ party: [] });
        setEvalResult(JSON.stringify(result, null, 2));
      } else {
        const result = detectQuestBlockers({ questId: '', graph: { quest: { id: '' }, clues: [], npcs: [] } });
        setEvalResult(JSON.stringify(result, null, 2));
      }
    } catch (err) {
      setEvalResult(err instanceof Error ? err.message : 'Fehler');
    }
  }

  function handleRuleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const params = JSON.parse(ev.target?.result as string) as Parameters<typeof importRules>[1];
        void importRules(database, params);
      } catch { /* ignore parse errors */ }
    };
    reader.readAsText(file);
  }


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
        return (
          <div className="workspace-area">
            <div className="workspace-area__sidebar maps-sidebar" style={{ width: mapsSidebarCollapsed ? 32 : mapsSidebarWidth, padding: mapsSidebarCollapsed ? 'var(--space-2) 0' : undefined }}>
              {!mapsSidebarCollapsed && (
                <Button
                  tone="accent"
                  variant="outline"
                  className="maps-sidebar__import"
                  onClick={() => void handleMapImport()}
                  disabled={mapImporting}
                >
                  {mapImporting ? t('mapImporting', '⏳ Importiere…') : t('importMap', '+ Karte importieren')}
                </Button>
              )}
              <MapsSidebarTabs
                selectedMapId={selectedMapId}
                collapsed={mapsSidebarCollapsed}
                onToggleCollapse={() => setMapsSidebarCollapsed((v) => !v)}
                mapsTabContent={
                  <>
                    {mapImporting && (
                      <div className="workspace-shell__info-note">
                        {t('mapImportProgress', 'Bild wird kopiert und vorbereitet…')}
                      </div>
                    )}
                    <MapFolderTree
                      database={database}
                      maps={maps}
                      selectedMapId={selectedMapId}
                      onSelectMap={setSelectedMapId}
                      onImportMap={() => void handleMapImport()}
                      importing={mapImporting}
                      onMapsChanged={() => { void listMaps(database).then(setMaps); }}
                    />
                    {maps.length === 0 && (
                      <p className="workspace-shell__empty-note">
                        {t('noMaps')}
                      </p>
                    )}
                  </>
                }
                layersTabContent={
                  selectedMapId && (
                    <div className="maps-layer-section">
                      <LayerPanel
                        key={`lp-${selectedMapId}`}
                        database={database}
                        mapId={selectedMapId}
                        editingFogLayerId={editingFogLayerId}
                        onEditFogLayer={(id) => { setMovingLayerId(null); setEditingFogLayerId((cur) => (cur === id ? null : id)); }}
                        movingLayerId={movingLayerId}
                        onMoveLayer={(id) => { setEditingFogLayerId(null); setMovingLayerId((cur) => (cur === id ? null : id)); }}
                        onAddImageLayer={() => void handleAddImageLayer()}
                        onAddFogLayer={() => void handleAddFogLayer()}
                        onLayerDeleted={(id) => {
                          setEditingFogLayerId((cur) => (cur === id ? null : cur));
                          setMovingLayerId((cur) => (cur === id ? null : cur));
                        }}
                        reloadKey={layerReloadKey}
                        onLayersChanged={() => setLayerReloadKey((n) => n + 1)}
                      />
                    </div>
                  )
                }
              />
            </div>
            {!mapsSidebarCollapsed && (
              <div
                className="maps-sidebar__resize-handle"
                role="separator"
                aria-orientation="vertical"
                onMouseDown={handleMapsSidebarResize}
              />
            )}
            <div className="workspace-shell__stage">
              {selectedMapId ? (
                <MapViewer
                  key={`mv-${selectedMapId}`}
                  mapId={selectedMapId}
                  sessionId={projectId}
                  database={database}
                  showCoordinates
                  onNavigateToEntity={navigateToEntity}
                  editFogLayerId={editingFogLayerId}
                  moveLayerId={movingLayerId}
                  reloadKey={layerReloadKey}
                  onLayersChanged={() => setLayerReloadKey((n) => n + 1)}
                  onPickTokenArt={handlePickTokenArt}
                />
              ) : (
                <div className="workspace-shell__empty-center">
                  {t('mapsEmptySelect')}
                </div>
              )}
            </div>
          </div>
        );

      case 'session':
        // M10-S22: the session icon is part of the play subset (D25). In edit mode
        // it is normally not visible, only when activePanel='session'
        // was set — then a hint that play mode is reached via the
        // toggle.
        return (
          <div className="workspace-area">
            <p>{t('sessionAreaEditHint', 'Play-Cockpit über den „Spielen"-Toggle in der Kopfzeile öffnen.')}</p>
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
                    onEventClick={(id) => setCalendarEditingEventId(id)}
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
                            createEventEntity(database, { title: calendarNewTitle.trim(), start_day: calendarNewDay, event_kind: 'single' })
                              .then(({ id }) => {
                                setCalendarNewDay(null);
                                setCalendarRefreshToken((n) => n + 1);
                                setCalendarEditingEventId(id);
                              })
                              .catch(console.error);
                          }}
                        />
                        <Button
                          tone="accent"
                          disabled={!calendarNewTitle.trim()}
                          onClick={() => {
                            createEventEntity(database, { title: calendarNewTitle.trim(), start_day: calendarNewDay, event_kind: 'single' })
                              .then(({ id }) => {
                                setCalendarNewDay(null);
                                setCalendarRefreshToken((n) => n + 1);
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
                        startInEditMode
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
        return (
          <div className="workspace-area">
            <ChronicleView database={database} />
          </div>
        );

      case 'cards':
        if (showPrintSheet) {
          return (
            <div className="workspace-area">
              <button onClick={() => setShowPrintSheet(false)}>← {t('back', { ns: 'common' })}</button>
              <PrintSheetComposer database={database} initialCards={selectedCardIds} />
            </div>
          );
        }
        if (showCardCreation) {
          return (
            <div className="workspace-area">
              <CardCreationFlow
                database={database}
                onComplete={(id) => {
                  setSelectedCardIds((prev) => [...prev, id]);
                  setShowCardCreation(false);
                }}
              />
            </div>
          );
        }
        return (
          <div className="workspace-area">
            <div className="workspace-area__toolbar">
              <button onClick={() => setShowCardCreation(true)}>{t('cardNew')}</button>
              <button onClick={() => setShowPrintSheet(true)}>{t('cardPrint')}</button>
            </div>
            <CardList database={database} />
          </div>
        );

      case 'plugins':
        return (
          <div className="workspace-area">
            <PluginManager />
          </div>
        );

      case 'rules':
        return (
          <div className="workspace-area">
            {/* #189: rule import */}
            <div className="workspace-area__toolbar">
              <label>
                {t('ruleImport')}
                <input type="file" accept=".json" onChange={handleRuleImport} />
              </label>
            </div>
            {/* #189: rule evaluations */}
            <div>
              <button onClick={() => runEvaluation('mystery')}>{t('ruleEvalMystery')}</button>
              <button onClick={() => runEvaluation('role')}>{t('ruleEvalRole')}</button>
              <button onClick={() => runEvaluation('quest')}>{t('ruleEvalQuest')}</button>
              {evalResult && <pre>{evalResult}</pre>}
            </div>
            <hr />
            {/* M13-S07 (#242): house-rule overlay library + per-session toggle. */}
            <ModuleLibrary database={database} />
            <hr />
            {selectedScreenId ? (
              <>
                <button onClick={() => setSelectedScreenId(null)}>{t('dmScreensBack')}</button>
                <DmScreen screenId={selectedScreenId} database={database} />
              </>
            ) : (
              <DmScreenSelector database={database} onSelectScreen={setSelectedScreenId} />
            )}
          </div>
        );

      case 'audio':
        return (
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
        );

      case 'graph':
        return (
          <div className="workspace-area">
            <GlobalGraphView database={database} onNavigate={navigateToEntity} />
          </div>
        );

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
            />
          </div>
        );
      case 'play-settings':
        // #390: play-scoped settings area — switch campaign/role,
        // leave the session. Built from primitives, colors from tokens.
        return (
          <div className="workspace-area">
            <h2>{t('play-settings')}</h2>
            <section className="u-stack u-gap-2">
              <h3>{t('playSettingsCampaign', 'Campaign')}</h3>
              {availableCampaigns.length > 0 ? (
                <Segmented
                  label={t('playSettingsCampaign', 'Campaign')}
                  value={activeSessionId ?? ''}
                  onChange={switchPlayCampaign}
                  size="compact"
                  options={availableCampaigns.map((c) => ({ id: c.id, label: c.title }))}
                />
              ) : (
                <p className="workspace-shell__empty-note">{t('playSettingsNoCampaigns', 'Keine Campaigns vorhanden.')}</p>
              )}
            </section>
            <hr />
            <section className="u-stack u-gap-2">
              <h3>{t('playSettingsRole', 'Rolle')}</h3>
              <Segmented
                label={t('playSettingsRole', 'Rolle')}
                value={sessionRole ?? 'dm'}
                onChange={(id) => switchPlayRole(id === 'player' ? 'player' : 'dm')}
                size="compact"
                options={[
                  { id: 'dm', label: t('modeRoleDm', 'Als DM') },
                  { id: 'player', label: t('modeRolePlayer', 'Als Player') },
                ]}
              />
            </section>
            <hr />
            <Button tone="danger" variant="outline" onClick={leavePlaySession}>
              {t('playSettingsLeave', 'Session verlassen')}
            </Button>
          </div>
        );
    }
  }

  const activeAreaLabel = t(activeArea);
  const visibleAreas = mode === 'play'
    ? AREAS.filter((a) => PLAY_AREAS.includes(a.id))
    : AREAS.filter((a) => a.id !== 'play-settings'); // #390: hide play-only in edit

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
      setSessionRole(null);
      setActiveSessionId(null);
      setShowRoleSelect(false);
    }
  }

  // #390: open the "campaign + role" selection step (only when no context).
  function openRoleSelect() {
    setShowRoleSelect(true);
    void listCampaigns(database).then((cs) => {
      setAvailableCampaigns(cs);
      if (cs.length === 1) setSelectedCampaignForPlay(cs[0].id);
    });
  }

  // #390: enter the remembered context directly. Edge case: if the campaign
  // no longer exists (deleted) → discard the context and fall back cleanly to the
  // selection step (no crash).
  async function enterPlay(campaignId: string, role: 'dm' | 'player') {
    const cs = await listCampaigns(database);
    setAvailableCampaigns(cs);
    if (!cs.some((c) => c.id === campaignId)) {
      clearPlayContext(projectId);
      if (cs.length === 1) setSelectedCampaignForPlay(cs[0].id);
      setShowRoleSelect(true);
      return;
    }
    setMode('play');
    setSessionRole(role);
    setActiveSessionId(campaignId);
    setSelectedCampaignForPlay(campaignId);
    setShowRoleSelect(false);
    setActiveArea('session');
  }

  async function pickRole(role: 'dm' | 'player') {
    let campaignId = selectedCampaignForPlay;
    if (campaignId === '') {
      // No campaign selected: the DM may auto-create one (prevents a
      // dead end in an empty project); the player needs a selection.
      if (role === 'dm') {
        const c = await createCampaign(database, { title: t('modeCampaignDefault', 'Default Campaign') });
        campaignId = c.id;
        setAvailableCampaigns((prev) => [...prev, c]);
      } else {
        return;
      }
    }
    setMode('play');
    setSessionRole(role);
    setActiveSessionId(campaignId);
    setSelectedCampaignForPlay(campaignId);
    setShowRoleSelect(false);
    setActiveArea('session');
    setPlayContext(projectId, { campaignId, role }); // #390: remember context
  }

  // #390 — play-settings actions (in play mode, its own area):
  /** Switch campaign without the edit detour — updates the active session + remembered context. */
  function switchPlayCampaign(campaignId: string) {
    if (campaignId === activeSessionId) return;
    setActiveSessionId(campaignId);
    setSelectedCampaignForPlay(campaignId);
    if (sessionRole === 'dm' || sessionRole === 'player') {
      setPlayContext(projectId, { campaignId, role: sessionRole });
    }
  }
  /** Switch role (DM/Player) — switching to player resets the join context. */
  function switchPlayRole(role: 'dm' | 'player') {
    if (role === sessionRole) return;
    setSessionRole(role);
    if (role === 'player') setPlayerContext(null);
    if (activeSessionId !== null) setPlayContext(projectId, { campaignId: activeSessionId, role });
  }
  /** Leave the session — clear the remembered context and back to edit. */
  function leavePlaySession() {
    clearPlayContext(projectId);
    setMode('edit');
    setSessionRole(null);
    setActiveSessionId(null);
    setShowRoleSelect(false);
    setActiveArea('entities');
  }
  async function createAndPickCampaign() {
    if (newCampaignTitle.trim() === '') return;
    const c = await createCampaign(database, { title: newCampaignTitle.trim() });
    setAvailableCampaigns((prev) => [...prev, c]);
    setSelectedCampaignForPlay(c.id);
    setNewCampaignTitle('');
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
  const inPlayCockpit = mode === 'play' && activeArea === 'session';

  // #374 D30: create the player store once the player context is fixed (an empty
  // store = "host offline"). Snapshot+delta is fed by the client transport
  // (wiring follows in R4 / #375).
  useEffect(() => {
    if (sessionRole !== 'player' || playerContext === null) { setPlayerStore(null); return; }
    setPlayerStore(createPlayClientStore({ playerId: playerContext.playerId }));
  }, [sessionRole, playerContext]);

  // M10-#386 (D29 feed): once both the player store AND transport exist, attach
  // the store to the transport feed — snapshot/delta (incl. token
  // movements) then flow into the DB-less client.
  useEffect(() => {
    if (playerStore === null || playerTransport === null) return;
    const dispose = attachClientStoreToTransport(playerTransport, playerStore);
    return () => dispose();
  }, [playerStore, playerTransport]);

  // #373 M10-R2 + S11: wire up host push + attach broker signaling.
  // In the host/connect model the DM is peer 'A' (initiator). appId = currentAppId
  // (per-host namespace from getHostSecret); roomId = campaignId. The signaling
  // adapter runs the fallback chain (Nostr → MQTT → BitTorrent → PeerJS) and
  // brokers SDP/ICE — game data stays P2P.
  useEffect(() => {
    if (mode !== 'play' || sessionRole !== 'dm' || activeSessionId === null) return;
    const transport = WebRtcTransport.host(activeSessionId, database);
    setHostTransport(transport);
    const campaignId = activeSessionId;
    void (async () => {
      await transport.connect();
      const appId = await currentAppId();
      await transport.attachSignaling({
        appId,
        roomId: campaignId,
        peerLabel: 'A',
        onError: (err) => console.warn('[host-signaling]', err.message),
      });
    })().catch((e) => console.warn('[host-signaling] setup failed', e));
    const unsub = attachVisibilityBroadcaster(transport);
    // M10-#386 (D18, host-authoritative): authorize incoming token movement intents
    // from players + persist the ground truth + broadcast to everyone.
    attachHostTokenSync({ transport, database, campaignId });
    // M10-#387 (D24/D29): DB-less join/reconnect handshake — validate player requests
    // against the host DB, create member + token + initial snapshot.
    attachHostJoinSync({ transport, database, campaignId });
    // M10-#386: send the initial snapshot of the presented map + tokens once
    // the host transport is up — otherwise the DB-less player store would never get
    // the scene (computeSnapshot was never sent before). present() re-pushes on
    // map change.
    void pushPresentedMapSnapshot({ database, campaignId, transport });
    return () => {
      unsub();
      setHostTransport(null);
      void transport.close().catch(() => {});
    };
  }, [mode, sessionRole, activeSessionId, database]);

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
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>
          {showRoleSelect ? (
            <Panel className="workspace-area workspace-shell__role-select" role="dialog"
              aria-label={t('modeRolePickTitle', 'Rolle wählen')}>
              <p>{t('modeRolePickPrompt', 'Campaign und Rolle wählen:')}</p>
              <div className="workspace-shell__role-campaign u-stack u-gap-2">
                {availableCampaigns.length > 0 && (
                  <Segmented
                    label={t('modeCampaign', 'Campaign')}
                    value={selectedCampaignForPlay}
                    onChange={setSelectedCampaignForPlay}
                    size="compact"
                    options={availableCampaigns.map((c) => ({ id: c.id, label: c.title }))}
                  />
                )}
                {availableCampaigns.length === 0 && (
                  <div className="u-row u-gap-2">
                    <Field
                      label={t('modeCampaignNew', 'Neue Campaign')}
                      value={newCampaignTitle}
                      onChange={(e) => setNewCampaignTitle(e.target.value)}
                      placeholder={t('modeCampaignNewPh', 'Titel')}
                    />
                    <Button
                      onClick={() => void createAndPickCampaign()}
                      disabled={newCampaignTitle.trim() === ''}
                    >
                      {t('modeCampaignCreate', 'Anlegen')}
                    </Button>
                  </div>
                )}
              </div>
              <div className="workspace-shell__role-buttons">
                <Button tone="accent" onClick={() => void pickRole('dm')}>
                  {t('modeRoleDm', 'Als DM')}
                </Button>
                <Button
                  disabled={selectedCampaignForPlay === ''}
                  onClick={() => void pickRole('player')}
                >
                  {t('modeRolePlayer', 'Als Player')}
                </Button>
                <Button variant="outline" onClick={() => setShowRoleSelect(false)}>
                  {t('cancel', { ns: 'common' })}
                </Button>
              </div>
            </Panel>
          ) : inPlayCockpit ? (
            sessionRole === 'dm' ? (
              <PlayModeView role={sessionRole} activeSessionId={activeSessionId} database={database} transport={hostTransport ?? undefined} />
            ) : playerContext !== null && activeSessionId !== null ? (
              // M10-S14: after the join the player sees the full cockpit
              // (map/combat log/spotlight/free-browse + sheet), filtered through
              // S09 (host-side content filter). Group IDs come from the
              // group_members table — the S09 filters are addressed to all of the
              // player's groups (D6).
              <PlayModeView
                role={sessionRole}
                activeSessionId={activeSessionId}
                store={playerStore ?? undefined}
                playerId={playerContext.playerId}
                playerGroupIds={playerGroupIds}
                transport={playerTransport ?? undefined}
              />
            ) : (
              // M10-S05 (#387): the player role starts with the DB-less join
              // flow — no `database` prop anymore (join runs as a transport handshake).
              <PlayerJoinView
                onJoined={async ({ playerId, displayName, transport }) => {
                  setPlayerContext({ playerId, displayName });
                  setPlayerTransport(transport ?? null); // #386 D29-Feed
                  // The player's group membership → filter context for S09.
                  try {
                    const rows = await database.select<{ group_id: string }>(
                      'SELECT group_id FROM group_members WHERE player_id = ?',
                      [playerId],
                    );
                    setPlayerGroupIds(rows.map((r) => r.group_id));
                  } catch { /* no group_members → empty list */ }
                }}
              />
            )
          ) : (
            renderArea()
          )}
        </div>
      </div>
    </AppModeContext.Provider>
  );
}
