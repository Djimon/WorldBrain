import { useState } from 'react';
import { listCardInstances, listCardTemplates } from '../services/card-service';
import { listEntitiesByType } from '../services/entity-service';
import type { DatabaseLike } from '../services/entity-service';

interface Props {
  database: DatabaseLike;
}

export function CardList({ database }: Props) {
  const [typeFilter, setTypeFilter] = useState('');

  const instances = listCardInstances(database);
  const templates = listCardTemplates(database);
  const entities = listEntitiesByType({ database, type: null }) as Array<{ id: string; type: string; title: string }>;

  const entityMap = Object.fromEntries(entities.map((e) => [e.id, e]));
  const templateMap = Object.fromEntries(templates.map((t) => [t.id, t]));

  const entityTypes = [...new Set(entities.map((e) => e.type))];

  const filtered = typeFilter
    ? instances.filter((c) => entityMap[c.entity_id]?.type === typeFilter)
    : instances;

  return (
    <div>
      <select
        aria-label="Filter by type"
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="">All types</option>
        {entityTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      {filtered.map((card) => {
        const entity = entityMap[card.entity_id];
        const tpl = templateMap[card.template_id];
        return (
          <div key={card.id}>
            {entity?.title ?? card.entity_id} — {tpl?.label ?? card.template_id}
          </div>
        );
      })}
    </div>
  );
}
