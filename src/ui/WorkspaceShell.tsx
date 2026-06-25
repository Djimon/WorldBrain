import { useEffect, useState } from 'react';
import { useDatabase } from '../services/DatabaseContext';
import { listEntityTypes } from '../services/plugin-entity-service';
import { listMaps, createMap } from '../services/map-service';
import { listViews } from '../services/saved-views-service';
import { importRules } from '../services/rule-import-service';
import { detectMysteryBreakers, analyzeRoleCoverage, detectQuestBlockers } from '../services/rule-evaluations';
import { listVars } from '../services/session-variable-service';
import { EntityMasterDetail } from './EntityMasterDetail';
import { GlobalSearch } from './GlobalSearch';
import { GlobalEntityGraph } from './GlobalEntityGraph';
import { ChronicleView } from './ChronicleView';
import { CalendarWizard } from './CalendarWizard';
import { CalendarMonthView } from './CalendarMonthView';
import { EntityTimeline } from './EntityTimeline';
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
import { SessionGridTracker } from './SessionGridTracker';
import { SessionClock } from './SessionClock';
import { SnapshotManager } from './SnapshotManager';
import { UpdateNotification } from './UpdateNotification';
import { MapViewer } from './MapViewer';
import { MarkerPanel } from './MapMarkers';

type Area =
  | 'entities'
  | 'search'
  | 'maps'
  | 'calendar'
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
}

interface Props {
  projectId: string;
  projectDir: string;
  snapshotsDir: string;
  onProjectClose: () => void;
}

const AREAS: { id: Area; label: string; icon: string }[] = [
  { id: 'entities', label: 'Entities',  icon: '🗂' },
  { id: 'search',   label: 'Suche',     icon: '🔍' },
  { id: 'maps',     label: 'Karten',    icon: '🗺' },
  { id: 'calendar', label: 'Kalender',  icon: '📅' },
  { id: 'cards',    label: 'Cards',     icon: '🃏' },
  { id: 'plugins',  label: 'Plugins',   icon: '🔌' },
  { id: 'rules',    label: 'Regeln',    icon: '📖' },
  { id: 'session',  label: 'Session',   icon: '🎲' },
  { id: 'project',  label: 'Projekt',   icon: '⚙' },
];

const CORE_ENTITY_TYPES = [
  'Character', 'Location', 'Faction', 'Item',
  'Quest', 'Event', 'Scene', 'Rule', 'Resource', 'Culture',
];

export function WorkspaceShell({ projectId, projectDir, snapshotsDir, onProjectClose }: Props) {
  const database = useDatabase();
  const [activeArea, setActiveArea] = useState<Area>('entities');
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>();
  const [entityType, setEntityType] = useState<string | null>('Character');
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  // #182: maps loaded once via lazy init, not on every render
  const [maps, setMaps] = useState(() => listMaps(database));
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showCardCreation, setShowCardCreation] = useState(false);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [activeCalendar, setActiveCalendar] = useState<CalendarRow | null>(null);
  const [evalResult, setEvalResult] = useState<string | null>(null);
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
    setSelectedEntityId(entityId);
    setActiveArea('entities');
  }

  function loadCalendarById(id: string): CalendarRow | null {
    const row = database.prepare('SELECT id, title, year_length_days, months_json, week_json FROM calendars WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: String(row.id),
      title: String(row.title),
      year_length_days: Number(row.year_length_days),
      months: JSON.parse(String(row.months_json ?? '[]')) as { name: string; days: number }[],
      week: JSON.parse(String(row.week_json ?? '[]')) as string[],
    };
  }

  function handleMapImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    createMap(database, { title: file.name.replace(/\.[^.]+$/, '') });
    setMaps(listMaps(database));
    e.target.value = '';
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
        importRules(database, params);
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
              <h3>Typ</h3>
              <ul>
                {allEntityTypes.map((t) => (
                  <li key={t}>
                    <button aria-pressed={entityType === t} onClick={() => setEntityType(t)}>
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
              <hr />
              <GlobalEntityGraph
                database={database}
                onNavigate={navigateToEntity}
                initialConfig={{ entityTypes: entityType ? [entityType] : [] }}
              />
            </div>
            <div className="workspace-area__main">
              <EntityMasterDetail
                database={database}
                initialType={entityType}
                selectedEntityId={selectedEntityId}
                onEntitySelect={setSelectedEntityId}
              />
            </div>
          </div>
        );

      case 'search': {
        // #187: saved views quick access
        const savedViews = listViews(database);
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
      }

      case 'maps':
        return (
          <div className="workspace-area">
            <div className="workspace-area__sidebar">
              <h3>Karten</h3>
                {/* #188: map import button */}
              <label>
                Karte importieren
                <input type="file" accept="image/*" onChange={handleMapImport} />
              </label>
              <ul>
                {maps.map((m) => (
                  <li key={m.id}>
                    <button aria-pressed={selectedMapId === m.id} onClick={() => setSelectedMapId(m.id)}>
                      {m.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="workspace-area__main">
              {selectedMapId ? (
                <>
                  <MapViewer mapId={selectedMapId} database={database} showCoordinates />
                  <MarkerPanel mapId={selectedMapId} database={database} onNavigateToEntity={navigateToEntity} />
                  {/* #188: SessionGridTracker */}
                  <SessionGridTracker
                    sessionId={projectId}
                    mapId={selectedMapId}
                    database={database}
                    cellSize={40}
                  />
                </>
              ) : (
                <p>Keine Karte ausgewählt.</p>
              )}
            </div>
          </div>
        );

      case 'calendar':
        return (
          <div className="workspace-area">
            {/* #185: CalendarWizard sets active calendar for month view and session clock */}
            <CalendarWizard
              database={database}
              onComplete={(id) => {
                if (id) setActiveCalendar(loadCalendarById(id));
              }}
            />
            <ChronicleView database={database} />
            {/* #185: CalendarMonthView — only rendered once a calendar is configured */}
            {activeCalendar && (
              <CalendarMonthView calendar={activeCalendar} database={database} />
            )}
            {/* #185: EntityTimeline — shows timeline for currently selected entity */}
            {selectedEntityId && entityType && (
              <EntityTimeline entityId={selectedEntityId} entityType={entityType} database={database} />
            )}
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

      case 'session': {
        const VALID_TYPES = new Set(['boolean', 'number', 'string', 'enum']);
        const sessionVars: VarDef[] = listVars(database, projectId)
          .filter((v) => VALID_TYPES.has(v.type))
          .map((v) => ({
            id: v.id,
            label: v.label,
            type: v.type as VarDef['type'],
          }));
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
              <p>Kein Kalender konfiguriert — SessionClock erst nach Kalender-Setup verfügbar.</p>
            )}
          </div>
        );
      }

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

  return (
    <div className="workspace-shell">
      <nav className="workspace-shell__sidebar" aria-label="Workspace navigation">
        {AREAS.map(({ id, label, icon }) => (
          <button
            key={id}
            data-area={id}
            aria-label={label}
            aria-pressed={activeArea === id}
            onClick={() => setActiveArea(id)}
            title={label}
          >
            {icon}
          </button>
        ))}
      </nav>
      <div className="workspace-shell__content">
        {renderArea()}
      </div>
    </div>
  );
}
