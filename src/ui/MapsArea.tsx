// pre-release S2-Folge (#412): the edit-mode maps area extracted into its own module so a
// release build with features.json "maps": false tree-shakes it — MapViewer (+ pixi/canvas),
// LayerPanel, MapsSidebarTabs, MapFolderTree and the map services — out of dist/. Reached
// only via WorkspaceShell's lazy, feature('maps')-gated 'maps' area (dynamic import()).
// Behavior preserved verbatim from the previous inline maps case (#291/#298/#315).
// `selectedMapId` stays lifted in WorkspaceShell (persists across area switches, #315).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { listMaps, importMapImage, type MapRow } from '../services/map-service';
import { copyMapAsset } from '../services/map-asset';
import { importImageLayer, createFogLayer } from '../services/map-layer-service';
import { MapViewer } from './MapViewer';
import { LayerPanel } from './LayerPanel';
import { MapsSidebarTabs } from './MapsSidebarTabs';
import { MapFolderTree } from './MapFolderTree';
import { Button } from './primitives';
import type { DatabaseLike } from '../services/entity-service';

export interface MapsAreaProps {
  database: DatabaseLike;
  projectId: string;
  projectDir?: string;
  selectedMapId: string | null;
  onSelectMap: (id: string | null) => void;
  onNavigateToEntity: (id: string) => void;
}

export function MapsArea({ database, projectId, projectDir, selectedMapId, onSelectMap, onNavigateToEntity }: MapsAreaProps) {
  const { t } = useTranslation('nav');
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [mapImporting, setMapImporting] = useState(false);
  // Resizable maps sidebar (same drag pattern as MapViewer's pin tree).
  const [mapsSidebarWidth, setMapsSidebarWidth] = useState(240);
  const [mapsSidebarCollapsed, setMapsSidebarCollapsed] = useState(false);
  // A layer edit (import/delete/fog stroke) -> MapViewer and LayerPanel reload
  // their layer list live, no remount.
  const [layerReloadKey, setLayerReloadKey] = useState(0);
  // Fog layer currently selected for painting (LayerPanel selects, MapViewer paints).
  const [editingFogLayerId, setEditingFogLayerId] = useState<string | null>(null);
  // Image layer currently in move mode (LayerPanel selects, MapViewer drags).
  const [movingLayerId, setMovingLayerId] = useState<string | null>(null);

  useEffect(() => {
    listMaps(database).then(setMaps).catch(console.error);
  }, [database]);

  // #315: dropping the transient fog/move selection when the map changes.
  useEffect(() => { setEditingFogLayerId(null); setMovingLayerId(null); }, [selectedMapId]);

  async function handleMapImport() {
    const selected = await openDialog({ filters: [{ name: t('fileFilterImages'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], multiple: false });
    if (typeof selected !== 'string') return;
    setMapImporting(true);
    try {
      const title = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Karte';
      const result = await importMapImage(database, { srcPath: selected, title, projectDir: projectDir ?? '' });
      const updatedMaps = await listMaps(database);
      setMaps(updatedMaps);
      onSelectMap(result.id);
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
                onSelectMap={onSelectMap}
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
            onNavigateToEntity={onNavigateToEntity}
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
}

export default MapsArea;
