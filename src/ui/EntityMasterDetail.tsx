import { useState, useEffect } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { listEntitiesByType } from '../services/entity-service';
import { EntityDetailView } from './EntityDetailView';

type EntityListItem = {
  id: string;
  type: string;
  title: string;
  summary: string;
};

type EntityMasterDetailProps = {
  initialType: string | null;
  selectedEntityId?: string;
  onEntitySelect?: (entityId: string) => void;
  database?: DatabaseLike;
};

export function EntityMasterDetail({ initialType, selectedEntityId, onEntitySelect, database }: EntityMasterDetailProps) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedEntityId ?? null);
  const [entities, setEntities] = useState<EntityListItem[]>([]);

  useEffect(() => {
    if (database) {
      listEntitiesByType({ database, type: initialType }).then(setEntities);
    }
  }, [database, initialType]);

  function handleSelect(id: string) {
    setSelectedId(id);
    onEntitySelect?.(id);
  }

  return (
    <div style={{ display: 'flex' }}>
      <div>
        <ul>
          {entities.map((entity: EntityListItem) => (
            <li key={entity.id}>
              <button type="button" onClick={() => handleSelect(entity.id)}>
                <span>{entity.title}</span>
                <span>{entity.type}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {selectedId && <EntityDetailView entityId={selectedId} database={database} />}
      </div>
    </div>
  );
}
