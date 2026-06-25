import { useState } from 'react';
import { useDatabase } from '../services/DatabaseContext';
import { EntityMasterDetail } from './EntityMasterDetail';
import { GlobalSearch } from './GlobalSearch';
import { GlobalEntityGraph } from './GlobalEntityGraph';
import { ChronicleView } from './ChronicleView';
import { CalendarWizard } from './CalendarWizard';
import { CardList } from './CardList';
import { CardCreationFlow } from './CardCreationFlow';
import { PrintSheetComposer } from './PrintSheetComposer';
import { PluginManager } from './PluginManager';
import { DmScreen, DmScreenSelector } from './DmScreen';
import { CaptureInbox } from './CaptureInbox';
import { EncounterCounters } from './EncounterCounters';
import { SnapshotManager } from './SnapshotManager';
import { UpdateNotification } from './UpdateNotification';
import { MapViewer } from './MapViewer';
import { MarkerPanel } from './MapMarkers';
import { listMaps } from '../services/map-service';

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

const ENTITY_TYPES = [
  'Character', 'Location', 'Faction', 'Item',
  'Quest', 'Event', 'Scene', 'Rule', 'Resource', 'Culture',
];

export function WorkspaceShell({ projectId, projectDir, snapshotsDir, onProjectClose }: Props) {
  const database = useDatabase();
  const [activeArea, setActiveArea] = useState<Area>('entities');
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>();
  const [entityType, setEntityType] = useState<string | null>('Character');
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showCardCreation, setShowCardCreation] = useState(false);
  const [showPrintSheet, setShowPrintSheet] = useState(false);

  function navigateToEntity(entityId: string) {
    setSelectedEntityId(entityId);
    setActiveArea('entities');
  }

  function renderArea() {
    switch (activeArea) {
      case 'entities':
        return (
          <div className="workspace-area">
            <div className="workspace-area__sidebar">
              <h3>Typ</h3>
              <ul>
                {ENTITY_TYPES.map((t) => (
                  <li key={t}>
                    <button
                      aria-pressed={entityType === t}
                      onClick={() => setEntityType(t)}
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
              <hr />
              <button onClick={() => setActiveArea('search')}>Graph-Ansicht</button>
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

      case 'search':
        return (
          <div className="workspace-area">
            <GlobalSearch database={database} onNavigate={navigateToEntity} />
          </div>
        );

      case 'maps': {
        const maps = listMaps(database);
        return (
          <div className="workspace-area">
            <div className="workspace-area__sidebar">
              <h3>Karten</h3>
              <ul>
                {maps.map((m) => (
                  <li key={m.id}>
                    <button
                      aria-pressed={selectedMapId === m.id}
                      onClick={() => setSelectedMapId(m.id)}
                    >
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
                  <MarkerPanel
                    mapId={selectedMapId}
                    database={database}
                    onNavigateToEntity={navigateToEntity}
                  />

                </>
              ) : (
                <p>Keine Karte ausgewählt.</p>
              )}
            </div>
          </div>
        );
      }

      case 'calendar':
        return (
          <div className="workspace-area">
            <CalendarWizard database={database} onComplete={() => {}} />
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
            {selectedScreenId ? (
              <>
                <button onClick={() => setSelectedScreenId(null)}>← Screens</button>
                <DmScreen screenId={selectedScreenId} database={database} />
              </>
            ) : (
              <DmScreenSelector
                database={database}
                onSelectScreen={setSelectedScreenId}
              />
            )}
          </div>
        );

      case 'session':
        return (
          <div className="workspace-area">
            <CaptureInbox sessionId={projectId} database={database} />
            <EncounterCounters sessionId={projectId} database={database} />
          </div>
        );

      case 'project':
        return (
          <div className="workspace-area">
            <h2>Projekt</h2>
            <SnapshotManager
              projectId={projectId}
              projectDir={projectDir}
              snapshotsDir={snapshotsDir}
              onRestored={() => { window.location.reload(); }}
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
