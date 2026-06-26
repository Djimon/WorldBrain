import { useState, useMemo, useEffect } from 'react';
import { listEntitiesByType, updateEntityProperties } from '../services/entity-service';
import type { DatabaseLike } from '../services/entity-service';

type PropertySchema = {
  type: 'string' | 'number' | 'boolean';
  title: string;
  enum?: string[];
};

interface Props {
  entityType: string;
  propertiesSchema?: Record<string, PropertySchema>;
  database?: DatabaseLike;
}

export function EntityTable({ entityType, propertiesSchema = {}, database }: Props) {
  const [entities, setEntities] = useState<Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    aliases?: string[];
    properties?: Record<string, unknown>;
  }>>([]);

  useEffect(() => {
    if (database) {
      listEntitiesByType({ database, type: entityType }).then(setEntities);
    }
  }, [entityType, database]);

  const propKeys = Object.keys(propertiesSchema);
  const allColumns = useMemo(() => ['title', ...propKeys], [propertiesSchema]);

  const [visibleCols, setVisibleCols] = useState(new Set(allColumns));
  const [showPicker, setShowPicker] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [titleFilter, setTitleFilter] = useState('');
  const [editCell, setEditCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  function handleColToggle(col: string) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  function handleSort(key: string) {
    setSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: 'asc' };
    });
  }

  function handleDoubleClick(id: string, key: string, value: unknown) {
    setEditCell({ id, key });
    setEditValue(String(value ?? ''));
  }

  async function handleEditCommit(entity: { id: string; properties?: Record<string, unknown> }) {
    if (!editCell || !database) return;
    const newProps = { ...(entity.properties ?? {}), [editCell.key]: editValue };
    await updateEntityProperties({ database, entityId: entity.id, properties: newProps });
    setEditCell(null);
  }

  let rows = [...entities];

  if (titleFilter) {
    rows = rows.filter((e) => e.title.toLowerCase().includes(titleFilter.toLowerCase()));
  }

  if (sort) {
    const { key, dir } = sort;
    rows = [...rows].sort((a, b) => {
      const av = key === 'title' ? a.title : String((a.properties ?? {})[key] ?? '');
      const bv = key === 'title' ? b.title : String((b.properties ?? {})[key] ?? '');
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  const shownCols = allColumns.filter((c) => visibleCols.has(c));

  return (
    <div>
      <div>
        <button
          aria-label="Toggle Columns"
          onClick={() => setShowPicker((p) => !p)}
        >
          Columns
        </button>
        <input
          type="text"
          aria-label="filter title"
          placeholder="filter title"
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
        />
        {showPicker && (
          <div>
            {allColumns.map((col) => (
              <label key={col}>
                <input
                  type="checkbox"
                  aria-label={col}
                  checked={visibleCols.has(col)}
                  onChange={() => handleColToggle(col)}
                />
                {propertiesSchema[col]?.title ?? col}
              </label>
            ))}
          </div>
        )}
      </div>
      <table>
        <thead>
          <tr>
            {shownCols.map((col) => (
              <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer' }}>
                {propertiesSchema[col]?.title ?? col.charAt(0).toUpperCase() + col.slice(1)}
                {sort?.key === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((entity) => (
            <tr key={entity.id}>
              {shownCols.map((col) => {
                const val = col === 'title' ? entity.title : String((entity.properties ?? {})[col] ?? '');
                const isEditing = editCell?.id === entity.id && editCell?.key === col;
                const schema = propertiesSchema[col];
                return (
                  <td key={col} onDoubleClick={() => handleDoubleClick(entity.id, col, val)}>
                    {isEditing ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => void handleEditCommit(entity)}
                        autoFocus
                      >
                        {schema?.enum
                          ? schema.enum.map((opt) => <option key={opt} value={opt}>{opt}</option>)
                          : [<option key={val} value={val}>{val}</option>]}
                      </select>
                    ) : val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
