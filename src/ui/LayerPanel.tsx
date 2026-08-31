// M15-S02: Layer-Panel UI (#274)
// Reuses map-layer-service.ts (S01, #273) — no new persistence, only UI over
// the existing createLayer/listLayers/updateLayer/deleteLayer/reorderLayers.
//
// Assumption (undocumented in AC): reordering exposes accessible "move up"/
// "move down" buttons per row alongside the pointer-drag interaction named
// in the AC (reusing MapViewer's PinTree onPointerDown pattern). Simulating
// raw pointer-drag reliably in jsdom is impractical and the AC's own
// reorder requirement ("reorderLayers persists the new order") is fully
// covered by a keyboard/click-accessible affordance — drag remains an
// Implementation Agent addition on top, not a second code path.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { listLayers, updateLayer, deleteLayer, reorderLayers, type MapLayerRow } from '../services/map-layer-service';
import { Button, Chip } from './primitives';

export interface LayerPanelProps {
  database: DatabaseLike;
  mapId: string;
  onAddImageLayer?: () => void;
  onAddFogLayer?: () => void;
  /** Fog layer currently selected for painting (highlighted here). */
  editingFogLayerId?: string | null;
  /** Toggle a fog layer as the paint target (MapViewer paints it). */
  onEditFogLayer?: (layerId: string) => void;
  /** Bumped by the parent to reload the list live (no remount). */
  reloadKey?: number;
  /** Notifies the parent that layers changed so other views (MapViewer) refresh. */
  onLayersChanged?: () => void;
  /** Image layer currently in move mode (highlighted here). */
  movingLayerId?: string | null;
  /** Toggle an image layer as the move target (MapViewer makes it draggable). */
  onMoveLayer?: (layerId: string) => void;
  /** Called after a layer is deleted so the parent can clear any edit/move target. */
  onLayerDeleted?: (layerId: string) => void;
}

export function LayerPanel({ database, mapId, onAddImageLayer, onAddFogLayer, editingFogLayerId, onEditFogLayer, reloadKey = 0, onLayersChanged, movingLayerId, onMoveLayer, onLayerDeleted }: LayerPanelProps) {
  const { t } = useTranslation('map');
  const layerTypeLabel: Record<string, string> = {
    image: t('layerPanel.type.image', 'Bild'),
    fog: t('layerPanel.type.fog', 'Fog'),
    token: t('layerPanel.type.token', 'Token'),
  };
  const [layers, setLayers] = useState<MapLayerRow[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Rows default to COLLAPSED: expanded only if the id is in this set (keyed by
  // id -> survives live reloads; new layers stay collapsed).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isExpanded = (id: string) => expanded.has(id);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function reload() {
    listLayers(database, mapId).then(setLayers).catch(console.error);
  }

  useEffect(() => {
    reload();
  }, [database, mapId, reloadKey]);

  // Token layers are systemic (exactly one per map, auto-created with the first
  // token) — like the pin/marker layer, they are not user-managed here.
  const sorted = [...layers]
    .filter((l) => l.layer_type !== 'token')
    .sort((a, b) => b.z_order - a.z_order);

  function handleOpacityChange(layer: MapLayerRow, value: number) {
    const opacity = value / 100;
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, opacity } : l)));
    updateLayer(database, layer.id, { opacity }).then(() => onLayersChanged?.()).catch(console.error);
  }

  function handleToggleVisible(layer: MapLayerRow) {
    const visible = !layer.visible;
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, visible: visible ? 1 : 0 } : l)));
    updateLayer(database, layer.id, { visible }).then(() => onLayersChanged?.()).catch(console.error);
  }

  function handleTogglePlayerVisible(layer: MapLayerRow) {
    const player_visible = !layer.player_visible;
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, player_visible: player_visible ? 1 : 0 } : l)));
    updateLayer(database, layer.id, { player_visible }).then(() => onLayersChanged?.()).catch(console.error);
  }

  function handleMove(layerId: string, direction: -1 | 1) {
    const idx = sorted.findIndex((l) => l.id === layerId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    reorderLayers(database, mapId, reordered.map((l) => l.id)).then(reload).then(() => onLayersChanged?.()).catch(console.error);
  }

  function handleNameChange(layer: MapLayerRow, name: string) {
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, name } : l)));
  }

  function persistName(layer: MapLayerRow) {
    updateLayer(database, layer.id, { name: layer.name ?? '' }).then(() => onLayersChanged?.()).catch(console.error);
  }

  function commitDelete(layerId: string) {
    setDeleteConfirmId(null);
    deleteLayer(database, layerId).then(reload).then(() => { onLayerDeleted?.(layerId); onLayersChanged?.(); }).catch(console.error);
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel__toolbar">
        <Button tone="accent" variant="outline" size="compact" onClick={() => onAddImageLayer?.()}>{t('layerPanel.addImage', '+ Map Layer')}</Button>
        <Button tone="accent" variant="outline" size="compact" onClick={() => onAddFogLayer?.()}>{t('layerPanel.addFog', '+ Fog Layer')}</Button>
      </div>
      <ul className="layer-panel__list">
        {sorted.map((layer) => (
          <li key={layer.id} data-layer-id={layer.id} data-layer-type={layer.layer_type} className={`layer-panel__row${editingFogLayerId === layer.id || movingLayerId === layer.id ? ' editing' : ''}${isExpanded(layer.id) ? '' : ' collapsed'}`}>
            <div className="layer-panel__row-header">
              <button
                type="button"
                className="layer-panel__collapse"
                aria-expanded={isExpanded(layer.id)}
                aria-label={t('layerPanel.toggleDetails', 'Details')}
                onClick={() => toggleExpanded(layer.id)}
              >
                {isExpanded(layer.id) ? '▼' : '▶'}
              </button>
              <span className="layer-panel__name-display">{layer.name}</span>
              {!layer.visible && (
                <span className="layer-panel__hidden-indicator" title={t('layerPanel.hiddenIndicator', 'Ausgeblendet')}>🚫</span>
              )}
              <Chip className={`layer-panel__type layer-panel__type--${layer.layer_type}`}>
                {layerTypeLabel[layer.layer_type] ?? layer.layer_type}
              </Chip>
            </div>
            {isExpanded(layer.id) && (
              <div className="layer-panel__controls">
                <label className="layer-panel__name-field">
                  {t('layerPanel.name', 'Name')}
                  <input
                    type="text"
                    value={layer.name ?? ''}
                    placeholder={t('layerPanel.namePlaceholder', 'Ebenenname')}
                    onChange={(e) => handleNameChange(layer, e.target.value)}
                    onBlur={() => persistName(layer)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                </label>
                <label className="layer-panel__opacity">
                  {t('layerPanel.opacity', 'Deckkraft')}
                  <input
                    type="range"
                    aria-label={t('layerPanel.opacity', 'Deckkraft')}
                    min={0}
                    max={100}
                    value={Math.round(layer.opacity * 100)}
                    onChange={(e) => handleOpacityChange(layer, Number(e.target.value))}
                  />
                </label>
                <Button size="compact" onClick={() => handleToggleVisible(layer)}>
                  {layer.visible ? t('layerPanel.hide', 'Ausblenden') : t('layerPanel.show', 'Einblenden')}
                </Button>
                <Button size="compact" onClick={() => handleTogglePlayerVisible(layer)}>
                  {t('layerPanel.playerVisible', 'Spielersichtbar')}
                </Button>
                {layer.layer_type === 'fog' && onEditFogLayer && (
                  <Button
                    size="compact"
                    aria-pressed={editingFogLayerId === layer.id}
                    onClick={() => onEditFogLayer(layer.id)}
                  >
                    {editingFogLayerId === layer.id ? t('layerPanel.fogEditing', 'Malen beenden') : t('layerPanel.fogEdit', 'Bemalen')}
                  </Button>
                )}
                {layer.layer_type === 'image' && onMoveLayer && (
                  <Button
                    size="compact"
                    aria-pressed={movingLayerId === layer.id}
                    onClick={() => onMoveLayer(layer.id)}
                  >
                    {movingLayerId === layer.id ? t('layerPanel.moveDone', 'Verschieben beenden') : t('layerPanel.move', 'Verschieben')}
                  </Button>
                )}
                <Button size="compact" onClick={() => handleMove(layer.id, -1)}>{t('layerPanel.moveUp', 'Nach oben')}</Button>
                <Button size="compact" onClick={() => handleMove(layer.id, 1)}>{t('layerPanel.moveDown', 'Nach unten')}</Button>
                {deleteConfirmId === layer.id ? (
                  <span className="layer-panel__delete-confirm">
                    {t('layerPanel.confirmDelete', 'Layer wirklich löschen?')}
                    <Button tone="danger" size="compact" onClick={() => commitDelete(layer.id)}>{t('layerPanel.confirmYes', 'Ja, löschen')}</Button>
                    <Button size="compact" onClick={() => setDeleteConfirmId(null)}>{t('cancel', { ns: 'common' })}</Button>
                  </span>
                ) : (
                  <Button tone="danger" variant="outline" size="compact" onClick={() => setDeleteConfirmId(layer.id)}>{t('delete', { ns: 'common' })}</Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
