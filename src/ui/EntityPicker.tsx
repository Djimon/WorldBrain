import React, { useState, useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const all: EntityListItem[] = listEntitiesByType({ database, type: typeFilter ?? null }) as EntityListItem[];

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
    <div role="combobox" aria-expanded={filtered.length > 0} aria-haspopup="listbox">
      <input
        ref={inputRef}
        role="searchbox"
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
        onKeyDown={handleKeyDown}
        placeholder="Search entities…"
        aria-autocomplete="list"
      />
      <ul role="listbox">
        {filtered.map((entity, i) => (
          <li
            key={entity.id}
            role="option"
            aria-selected={i === activeIndex}
            onClick={() => onSelect(entity.id)}
            style={{ cursor: 'pointer', background: i === activeIndex ? '#eee' : undefined }}
          >
            <span>{entity.title}</span>
            <span style={{ marginLeft: 8, fontSize: '0.8em', opacity: 0.7 }}>{entity.type}</span>
            {entity.summary && (
              <span style={{ marginLeft: 8, fontSize: '0.8em' }}>{entity.summary}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
