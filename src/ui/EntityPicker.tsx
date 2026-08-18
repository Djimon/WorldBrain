import React, { useState, useRef, useEffect } from 'react';
import { ListRow } from './primitives';
import { stripMarkdown } from '../utils/markdown';
import type { DatabaseLike } from '../services/entity-service';
import { listEntitiesByType } from '../services/entity-service';

interface EntityListItem {
  id: string;
  type: string;
  title: string;
  summary: string;
  aliases: string[];
}

interface Props {
  onSelect: (entityId: string) => void;
  typeFilter?: string | null;
  database: DatabaseLike;
}

export function EntityPicker({ onSelect, typeFilter = null, database }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [all, setAll] = useState<EntityListItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listEntitiesByType({ database, type: typeFilter ?? null })
      .then(rows => setAll(rows as EntityListItem[])).catch(console.error);
  }, [database, typeFilter]);

  const lower = query.toLowerCase();
  const filtered = query
    ? all.filter(
        (e) =>
          e.title.toLowerCase().includes(lower) ||
          (e.aliases ?? []).some((a) => a.toLowerCase().includes(lower))
      )
    : all;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        onSelect(filtered[activeIndex].id);
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      setActiveIndex(-1);
    }
  }

  return (
    <div className="entity-picker" role="combobox" aria-expanded={filtered.length > 0} aria-haspopup="listbox">
      <input
        ref={inputRef}
        className="entity-picker__input"
        role="searchbox"
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
        onKeyDown={handleKeyDown}
        placeholder="Search entities…"
        aria-autocomplete="list"
      />
      <ul className="entity-picker__list" role="listbox">
        {filtered.map((entity, i) => (
          <ListRow
            as="li"
            key={entity.id}
            className="u-items-baseline entity-picker__item"
            selected={i === activeIndex}
            role="option"
            aria-selected={i === activeIndex}
            onClick={() => onSelect(entity.id)}
          >
            <span className="entity-picker__item-title">{entity.title}</span>
            <span className="entity-picker__item-type">{entity.type}</span>
            {entity.summary && (
              <span className="entity-picker__item-summary">{stripMarkdown(entity.summary)}</span>
            )}
          </ListRow>
        ))}
      </ul>
    </div>
  );
}
