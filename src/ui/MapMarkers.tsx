import { useState } from 'react';
import { getMarkersForMap, createMarker, deleteMarker } from '../services/map-marker-service';

interface MarkerRow {
  id: string;
  map_id: string;
  entity_id: string | null;
  kind: string;
  geometry_json: string;
  label_text: string | null;
  elevation_value: number | null;
  elevation_unit: string | null;
  visibility_json: string;
}

interface Props {
  mapId: string;
  database: unknown;
  onNavigateToEntity?: (entityId: string) => void;
}

export function MarkerPanel({ mapId, database, onNavigateToEntity }: Props) {
  const [kindFilter, setKindFilter] = useState('');
  const [markers, setMarkers] = useState<MarkerRow[]>(() =>
    getMarkersForMap(database as never, mapId) as MarkerRow[]
  );

  function refresh() {
    setMarkers(getMarkersForMap(database as never, mapId) as MarkerRow[]);
  }

  const filtered = kindFilter ? markers.filter(m => m.kind === kindFilter) : markers;

  function handleAdd() {
    createMarker(database as never, {
      map_id: mapId,
      entity_id: null,
      kind: 'pin',
      geometry_json: '{"x":0,"y":0}',
      label_text: 'New Marker',
      elevation_value: null,
      elevation_unit: null,
      visibility_json: '"public"',
    });
    refresh();
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteMarker(database as never, id);
    setMarkers(prev => prev.filter(m => m.id !== id));
  }

  return (
    <div>
      <div>
        <label htmlFor="kind-filter">Kind</label>
        <select id="kind-filter" value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
          <option value="">All</option>
          <option value="pin">Point</option>
          <option value="polygon">Shape</option>
          <option value="label">Caption</option>
        </select>
        <button onClick={handleAdd}>Add Marker</button>
      </div>
      <ul>
        {filtered.map(m => (
          <li
            key={m.id}
            data-marker-id={m.id}
            style={{ cursor: m.entity_id ? 'pointer' : 'default' }}
            onClick={() => m.entity_id && onNavigateToEntity?.(m.entity_id)}
          >
            <span>{m.label_text}</span>
            <span> [{m.kind}]</span>
            {m.elevation_value != null && (
              <span> {m.elevation_value}{m.elevation_unit}</span>
            )}
            <button aria-label="delete" onClick={e => handleDelete(m.id, e)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
