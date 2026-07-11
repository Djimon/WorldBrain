import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../services/DatabaseContext';
import { listEntityTypes } from '../services/plugin-entity-service';
import { listMaps, importMapImage } from '../services/map-service';
import type { MapRow } from '../services/map-service';
import { listViews } from '../services/saved-views-service';
import type { SavedViewRow } from '../services/saved-views-service';
import { importRules } from '../services/rule-import-service';
import { detectMysteryBreakers, analyzeRoleCoverage, detectQuestBlockers } from '../services/rule-evaluations';
import { listVars } from '../services/session-variable-service';
import type { VarRow } from '../services/session-variable-service';
import { EntityMasterDetail } from './EntityMasterDetail';
import { GlobalSearch } from './GlobalSearch';
import { ChronicleView } from './ChronicleView';
import { CalendarWizard } from './CalendarWizard';
import { listCalendars, setActiveCalendar as persistActiveCalendar, deleteCalendar } from '../services/calendar-service';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarLinkPanel } from './CalendarLinkPanel';
import { CardList } from './CardList';
import { CardCreationFlow } from './CardCreationFlow';
import { PrintSheetComposer } from './PrintSheetComposer';
import { PluginManager } from './PluginManager';
import { DmScreen, DmScreenSelector } from './DmScreen';
import { CaptureInbox } from './CaptureInbox';
import { EncounterCounters } from './EncounterCounters';
import { ConditionBuilder } from './ConditionBuilder';
import type { VarDef } from './ConditionBuilder';
import { PlayerScreen } from './PlayerScreen';
import { SessionClock } from './SessionClock';
import { SnapshotManager } from './SnapshotManager';
import { UpdateNotification } from './UpdateNotification';
import { MapViewer } from './MapViewer';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

type Area =
  | 'entities'
  | 'search'
  | 'maps'
  | 'calendar'
  | 'chronicle'
  | 'cards'
  | 'plugins'
  | 'rules'
  | 'session'
  | 'project';

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
  projectId: string;
  projectTitle?: string;
  projectDir: string;
  snapshotsDir: string;
  onProjectClose: () => void;
}

const AREAS: { id: Area; icon: string }[] = [
  { id: 'entities', icon: '🗂' },
  { id: 'search',   icon: '🔍' },
  { id: 'maps',     icon: '🗺' },
  { id: 'calendar', icon: '📅' },
  { id: 'chronicle',icon: '📜' },
  { id: 'cards',    icon: '🃏' },
  { id: 'plugins',  icon: '🔌' },
  { id: 'rules',    icon: '📖' },
  { id: 'session',  icon: '🎲' },
  { id: 'project',  icon: '⚙' },
];

const CORE_ENTITY_TYPES = [
  'Character', 'Location', 'Faction', 'Item',
  'Quest', 'Event', 'Scene', 'Rule', 'Resource', 'Culture',
];

export function WorkspaceShell({ projectId, projectTitle, projectDir, snapshotsDir, onProjectClose }: Props) {
  const { t } = useTranslation('nav');
  const database = useDatabase();
  const [activeArea, setActiveArea] = useState<Area>('entities');
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
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [mapImporting, setMapImporting] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedViewRow[]>([]);
  const [sessionVarsRaw, setSessionVarsRaw] = useState<VarRow[]>([]);

  useEffect(() => {
    listMaps(database).then(setMaps).catch(console.error);
  }, [database]);

  useEffect(() => {
    listViews(database).then(setSavedViews).catch(console.error);
  }, [database]);

  useEffect(() => {
    listVars(database, projectId).then(setSessionVarsRaw).catch(console.error);
  }, [database, projectId]);

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

  const pluginEntityTypes = listEntityTypes().map((t) => t.id);
  const allEntityTypes = [...CORE_ENTITY_TYPES, ...pluginEntityTypes.filter((t) => !CORE_ENTITY_TYPES.includes(t))];

  function navigateToEntity(entityId: string) {
    // Navigate the whole path, not just the leaf detail view: switch the TYP
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
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], multiple: false });
    if (typeof selected !== 'string') return;
    setMapImporting(true);
    try {
      const title = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Karte';
      const result = await importMapImage(database, { srcPath: selected, title, projectDir });
      const updatedMaps = await listMaps(database);
      setMaps(updatedMaps);
      setSelectedMapId(result.id);
    } finally {
      setMapImporting(false);
    }
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

  const VALID_TYPES = new Set(['boolean', 'number', 'string', 'enum']);
  const sessionVars: VarDef[] = sessionVarsRaw
    .filter((v) => VALID_TYPES.has(v.type))
    .map((v) => ({
      id: v.id,
      label: v.label,
      type: v.type as VarDef['type'],
    }));

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
                <h3>Gespeicherte Ansichten</h3>
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
          <div className="workspace-area" style={{ overflow: 'hidden' }}>
            <div className="workspace-area__sidebar">
              <h3>{t('maps')}</h3>
              <button
                className="emd__create-btn"
                style={{ width: '100%', marginBottom: 'var(--space-2)' }}
                onClick={() => void handleMapImport()}
                disabled={mapImporting}
              >
                {mapImporting ? '⏳ Importiere…' : '+ Karte importieren'}
              </button>
              {mapImporting && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: 'var(--space-1) var(--space-2)', background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)' }}>
                  Bild wird kopiert und vorbereitet…
                </div>
              )}
              <ul>
                {maps.map((m) => (
                  <li key={m.id}>
                    <button
                      className={`emd__item${selectedMapId === m.id ? ' emd__item--active' : ''}`}
                      onClick={() => setSelectedMapId(m.id)}
                    >
                      <span className="emd__item-title">{m.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {maps.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: 'var(--space-2)' }}>
                  {t('noMaps')}
                </p>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {selectedMapId ? (
                <MapViewer mapId={selectedMapId} sessionId={projectId} database={database} showCoordinates onNavigateToEntity={navigateToEntity} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                  Karte aus der Liste wählen oder importieren
                </div>
              )}
            </div>
          </div>
        );

      case 'calendar':
        return (
          <div className="workspace-area" style={{ flexDirection: 'column', overflow: 'hidden' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <strong>{activeCalendar.title}</strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{activeCalendar.year_length_days} Tage/Jahr · {activeCalendar.months.length} Monate · {activeCalendar.week.length} Wochentage</span>
                  {deletePrompt ? (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span>Kalender „{activeCalendar.title}" löschen — bist du sicher?</span>
                      <button className="btn" style={{ color: 'var(--color-status-failure)' }} onClick={removeActiveCalendar}>Ja, löschen</button>
                      <button className="btn" onClick={() => setDeletePrompt(false)}>Abbrechen</button>
                    </span>
                  ) : (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <button className="btn" onClick={() => setShowPicker(true)}>Kalenderauswahl</button>
                      <button className="btn" onClick={() => setWizardCal(activeCalendar)}>{t('changeCalendar')}</button>
                      <button className="btn" style={{ color: 'var(--color-status-failure)' }} onClick={() => setDeletePrompt(true)}>Löschen</button>
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <CalendarMonthView calendar={activeCalendar} database={database} />
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
                <h2 className="cal-start__title">Kalender</h2>
                <div className="cal-start__row">
                  <select className="cal-form__select cal-start__select" aria-label="Kalender auswählen"
                    value={startSelId} disabled={calendarList.length === 0}
                    onChange={(e) => setStartSelId(e.target.value)}>
                    {calendarList.length === 0
                      ? <option value="">Noch keine Kalender</option>
                      : calendarList.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <button className="btn btn--primary" disabled={!startSelId} onClick={() => activateCalendar(startSelId)}>Aktivieren</button>
                  <button className="btn" disabled={!startSelId} onClick={() => editCalendarById(startSelId)}>Bearbeiten</button>
                </div>
                <button className="btn cal-start__new" onClick={() => setWizardCal('new')}>+ Neuen Kalender erstellen</button>
                {activeCalendar && (
                  <button className="btn cal-start__new" onClick={() => setShowPicker(false)}>← Zurück zur Ansicht</button>
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
              <button onClick={() => setShowPrintSheet(false)}>← Zurück</button>
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
              <button onClick={() => setShowCardCreation(true)}>Neue Card</button>
              <button onClick={() => setShowPrintSheet(true)}>Drucken</button>
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
                Regeln importieren
                <input type="file" accept=".json" onChange={handleRuleImport} />
              </label>
            </div>
            {/* #189: rule evaluations */}
            <div>
              <button onClick={() => runEvaluation('mystery')}>Mystery Breaker prüfen</button>
              <button onClick={() => runEvaluation('role')}>Rollenabdeckung analysieren</button>
              <button onClick={() => runEvaluation('quest')}>Quest-Blockaden prüfen</button>
              {evalResult && <pre>{evalResult}</pre>}
            </div>
            <hr />
            {selectedScreenId ? (
              <>
                <button onClick={() => setSelectedScreenId(null)}>← Screens</button>
                <DmScreen screenId={selectedScreenId} database={database} />
              </>
            ) : (
              <DmScreenSelector database={database} onSelectScreen={setSelectedScreenId} />
            )}
          </div>
        );

      case 'session':
        return (
          <div className="workspace-area">
            <CaptureInbox sessionId={projectId} database={database} />
            <EncounterCounters sessionId={projectId} database={database} />
            {/* #185: ConditionBuilder with session variables from DB */}
            <ConditionBuilder variables={sessionVars} onChange={() => {}} />
            {/* #185: PlayerScreen in GM mode */}
            <PlayerScreen context={{ audience: 'gm' }} database={database} />
            {/* #185: SessionClock — only rendered once a calendar is configured */}
            {activeCalendar ? (
              <SessionClock
                sessionId={projectId}
                calendar={activeCalendar}
                worldTimeStart={0}
                database={database}
              />
            ) : (
              <p>{t('noCalendar')}</p>
            )}
          </div>
        );

      case 'project':
        return (
          <div className="workspace-area">
            <h2>Projekt</h2>
            {/* #183: no window.location.reload() — close project and reopen via welcome screen */}
            <SnapshotManager
              projectId={projectId}
              projectDir={projectDir}
              snapshotsDir={snapshotsDir}
              onRestored={onProjectClose}
            />
            <hr />
            <UpdateNotification />
            <hr />
            <button onClick={onProjectClose}>Projekt schließen</button>
          </div>
        );
    }
  }

  const activeAreaLabel = t(activeArea);

  return (
    <div className="workspace-shell">
      <nav className="workspace-shell__sidebar" aria-label="Workspace navigation">
        {AREAS.map(({ id, icon }) => (
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
        <header className="workspace-shell__header">
          <span className="workspace-shell__project-name">{projectTitle ?? projectId}</span>
          <span className="workspace-shell__area-name">{activeAreaLabel}</span>
          <div className="workspace-shell__header-controls">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        {renderArea()}
      </div>
    </div>
  );
}
