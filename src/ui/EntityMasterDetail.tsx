import { useState, useEffect } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { listEntitiesByType } from '../services/entity-service';
import { EntityDetailView } from './EntityDetailView';

type EntityListItem = { id: string; type: string; title: string; summary: string };

interface Props {
  initialType: string | null;
  selectedEntityId?: string;
  onEntitySelect?: (entityId: string) => void;
  database?: DatabaseLike;
}

async function createEntity(db: DatabaseLike, type: string, title: string): Promise<string> {
  const id = `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO base_entities (id, type, title, summary, properties_json, created_at, updated_at)
     VALUES (?, ?, ?, '', '{}', ?, ?)`,
    [id, type, title, now, now],
  );
  return id;
}

export function EntityMasterDetail({ initialType, selectedEntityId, onEntitySelect, database }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedEntityId ?? null);
  const [entities, setEntities] = useState<EntityListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  function reload() {
    if (!database) return;
    listEntitiesByType({ database, type: initialType }).then(setEntities).catch(console.error);
  }

  useEffect(() => {
    setSelectedId(null);
    reload();
  }, [database, initialType]);

  function handleSelect(id: string) {
    setSelectedId(id);
    onEntitySelect?.(id);
  }

  async function handleCreate() {
    if (!database || !newTitle.trim() || !initialType) return;
    const id = await createEntity(database, initialType, newTitle.trim());
    setNewTitle('');
    setCreating(false);
    reload();
    handleSelect(id);
  }

  return (
    <div className="emd">
      <div className="emd__list">
        <div className="emd__list-header">
          <span className="emd__list-count">{entities.length} {initialType ?? 'Entities'}</span>
          <button
            className="emd__create-btn"
            onClick={() => setCreating(true)}
            title={`Neue ${initialType ?? 'Entity'} erstellen`}
          >
            + Neu
          </button>
        </div>

        {creating && (
          <div className="emd__create-form">
            <input
              autoFocus
              className="emd__create-input"
              placeholder={`Name der ${initialType ?? 'Entity'}â€¦`}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewTitle(''); }
              }}
            />
            <button className="emd__create-confirm" onClick={() => void handleCreate()}>Erstellen</button>
            <button className="emd__create-cancel" onClick={() => { setCreating(false); setNewTitle(''); }}>âœ•</button>
          </div>
        )}

        {entities.length === 0 && !creating && (
          <div className="emd__empty">
            <p>Keine {initialType ?? 'Entities'} vorhanden.</p>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>
              Erste {initialType ?? 'Entity'} erstellen
            </button>
          </div>
        )}

        <ul className="emd__items">
          {entities.map((e) => (
            <li key={e.id}>
              <button
                className={`emd__item${selectedId === e.id ? ' emd__item--active' : ''}`}
                onClick={() => handleSelect(e.id)}
              >
                <span className="emd__item-title">{e.title}</span>
                {e.summary && <span className="emd__item-summary">{e.summary}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="emd__detail">
        {selectedId
          ? <EntityDetailView entityId={selectedId} database={database} onNavigateToEntity={handleSelect} />
          : <div className="emd__detail-empty">Entity auswÃ¤hlen oder neu erstellen</div>
        }
      </div>
    </div>
  );
}

