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

export interface LayerPanelProps {
  database: DatabaseLike;
  mapId: string;
  onAddImageLayer?: () => void;
  onAddFogLayer?: () => void;
}

const LAYER_TYPE_ICON: Record<string, string> = { image: '🖼️', fog: '🌫️', token: '🎯' };

export function LayerPanel({ database, mapId, onAddImageLayer, onAddFogLayer }: LayerPanelProps) {
  const { t } = useTranslation();
  const [layers, setLayers] = useState<MapLayerRow[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function reload() {
    listLayers(database, mapId).then(setLayers).catch(console.error);
  }

  useEffect(() => {
    reload();
  }, [database, mapId]);

  const sorted = [...layers].sort((a, b) => b.z_order - a.z_order);

  function handleOpacityChange(layer: MapLayerRow, value: number) {
    const opacity = value / 100;
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, opacity } : l)));
    updateLayer(database, layer.id, { opacity }).catch(console.error);
  }

  function handleToggleVisible(layer: MapLayerRow) {
    const visible = !layer.visible;
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, visible: visible ? 1 : 0 } : l)));
    updateLayer(database, layer.id, { visible }).catch(console.error);
  }

  function handleTogglePlayerVisible(layer: MapLayerRow) {
    const player_visible = !layer.player_visible;
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, player_visible: player_visible ? 1 : 0 } : l)));
    updateLayer(database, layer.id, { player_visible }).catch(console.error);
  }

  function handleMove(layerId: string, direction: -1 | 1) {
    const idx = sorted.findIndex((l) => l.id === layerId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    reorderLayers(database, mapId, reordered.map((l) => l.id)).then(reload).catch(console.error);
  }

  function commitDelete(layerId: string) {
    setDeleteConfirmId(null);
    deleteLayer(database, layerId).then(reload).catch(console.error);
  }

  function startEditName(layer: MapLayerRow) {
    setEditingNameId(layer.id);
    setDraftName(layer.name ?? '');
  }

  function commitName(layer: MapLayerRow) {
    setEditingNameId(null);
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, name: draftName } : l)));
    updateLayer(database, layer.id, { name: draftName }).catch(console.error);
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel__toolbar">
        <button type="button" onClick={() => onAddImageLayer?.()}>{t('layerPanel.addImage', 'Bild-Layer hinzufügen')}</button>
        <button type="button" onClick={() => onAddFogLayer?.()}>{t('layerPanel.addFog', 'Fog-Layer hinzufügen')}</button>
      </div>
      <ul className="layer-panel__list">
        {sorted.map((layer) => (
          <li key={layer.id} className="layer-panel__row" aria-label={layer.name ?? ''}>
            <span className="layer-panel__icon">{LAYER_TYPE_ICON[layer.layer_type] ?? '📄'}</span>
            {editingNameId === layer.id ? (
              <input
                className="layer-panel__name-input"
                aria-label={t('layerPanel.name', 'Name')}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => commitName(layer)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(layer); }}
                autoFocus
              />
            ) : (
              <span className="layer-panel__name" onDoubleClick={() => startEditName(layer)}>{layer.name}</span>
            )}
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
            <button type="button" onClick={() => handleToggleVisible(layer)}>
              {layer.visible ? t('layerPanel.hide', 'Ausblenden') : t('layerPanel.show', 'Einblenden')}
            </button>
            {!layer.visible && (
              <span className="layer-panel__hidden-indicator">{t('layerPanel.hiddenIndicator', 'Ausgeblendet')}</span>
            )}
            <button type="button" onClick={() => handleTogglePlayerVisible(layer)}>
              {t('layerPanel.playerVisible', 'Spielersichtbar')}
            </button>
            <button type="button" onClick={() => handleMove(layer.id, -1)}>{t('layerPanel.moveUp', 'Nach oben')}</button>
            <button type="button" onClick={() => handleMove(layer.id, 1)}>{t('layerPanel.moveDown', 'Nach unten')}</button>
            {deleteConfirmId === layer.id ? (
              <span className="layer-panel__delete-confirm">
                {t('layerPanel.confirmDelete', 'Layer wirklich löschen?')}
                <button type="button" onClick={() => commitDelete(layer.id)}>{t('layerPanel.confirmYes', 'Ja, löschen')}</button>
                <button type="button" onClick={() => setDeleteConfirmId(null)}>{t('layerPanel.confirmNo', 'Abbrechen')}</button>
              </span>
            ) : (
              <button type="button" onClick={() => setDeleteConfirmId(layer.id)}>{t('layerPanel.delete', 'Löschen')}</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
