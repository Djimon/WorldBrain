import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { listEntitiesByType } from '../services/entity-service';
import { EntityDetailView } from './EntityDetailView';
import { Button, ListRow } from './primitives';
import { stripMarkdown } from '../utils/markdown';

type EntityListItem = { id: string; type: string; title: string; summary: string };

interface Props {
  initialType: string | null;
  selectedEntityId?: string;
  onEntitySelect?: (entityId: string) => void;
  /** Cross-type navigation (mentions/backlinks): bubbles up so the parent can
   *  switch the TYP list too, not just swap the detail view. */
  onNavigateToEntity?: (entityId: string) => void;
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

export function EntityMasterDetail({ initialType, selectedEntityId, onEntitySelect, onNavigateToEntity, database }: Props) {
  const { t } = useTranslation('entity');
  const [selectedId, setSelectedId] = useState<string | null>(selectedEntityId ?? null);
  const [entities, setEntities] = useState<EntityListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const typeName = initialType ? t(`type.${initialType.toLowerCase()}`, { defaultValue: initialType }) : 'Entities';

  function reload() {
    if (!database) return;
    listEntitiesByType({ database, type: initialType }).then(setEntities).catch(console.error);
  }

  useEffect(() => {
    setSelectedId(null);
    reload();
  }, [database, initialType]);

  // Keep the list selection in sync when the parent drives navigation
  // (mention/backlink click switches type + id from outside).
  useEffect(() => {
    if (selectedEntityId) setSelectedId(selectedEntityId);
  }, [selectedEntityId]);

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
          <span className="emd__list-count">{entities.length} {typeName}</span>
          <Button
            tone="accent"
            variant="outline"
            size="compact"
            onClick={() => setCreating(true)}
            title={t('new')}
          >
            {t('new')}
          </Button>
        </div>

        {creating && (
          <div className="emd__create-form">
            <input
              autoFocus
              className="emd__create-input"
              placeholder={t('namePlaceholder', { type: typeName })}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewTitle(''); }
              }}
            />
            <Button tone="accent" size="compact" onClick={() => void handleCreate()}>{t('create')}</Button>
            <Button variant="ghost" size="compact" onClick={() => { setCreating(false); setNewTitle(''); }}>✕</Button>
          </div>
        )}

        {entities.length === 0 && !creating && (
          <div className="emd__empty">
            <p>{t('noneFound', { type: typeName })}</p>
            <Button tone="accent" onClick={() => setCreating(true)}>
              {t('createFirst', { type: typeName })}
            </Button>
          </div>
        )}

        <ul className="emd__items">
          {entities.map((e) => (
            <li key={e.id}>
              <ListRow
                className="u-stack u-items-start u-gap-0"
                selected={selectedId === e.id}
                onClick={() => handleSelect(e.id)}
              >
                <span className="emd__item-title">{e.title}</span>
                {e.summary && <span className="emd__item-summary">{stripMarkdown(e.summary)}</span>}
              </ListRow>
            </li>
          ))}
        </ul>
      </div>

      <div className="emd__detail">
        {selectedId
          ? <EntityDetailView entityId={selectedId} database={database} onNavigateToEntity={onNavigateToEntity ?? handleSelect}
              onDeleted={() => { setSelectedId(null); reload(); }} />
          : <div className="emd__detail-empty">{t('selectOrCreate')}</div>
        }
      </div>
    </div>
  );
}
