import { useState } from 'react';
import { searchEntities, getSearchFacets } from '../services/search-service';
import type { SearchResult } from '../services/search-service';
import type { DatabaseLike } from '../services/entity-service';

interface Props {
  onNavigate: (entityId: string) => void;
  database?: DatabaseLike;
}

export function GlobalSearch({ onNavigate, database }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);

  function handleChange(value: string) {
    setQuery(value);
    setSelectedIndex(-1);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const res = searchEntities(database!, value, {});
    setResults(res);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = filtered[selectedIndex] ?? filtered[0];
      if (item) onNavigate(item.entityId);
    } else if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
    }
  }

  const facets = results.length > 0 ? getSearchFacets(database!, query, {}) : null;
  const filtered = activeTypeFilter
    ? results.filter((r) => r.entityType === activeTypeFilter)
    : results;

  return (
    <div>
      <input
        role="searchbox"
        aria-label="Search"
        type="search"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search entities…"
      />
      {facets && (
        <div>
          {Object.entries(facets.entityTypes).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
            >
              {type} ({count})
            </button>
          ))}
        </div>
      )}
      <ul>
        {filtered.map((r, i) => (
          <li
            key={r.entityId}
            role="option"
            aria-selected={i === selectedIndex}
            onClick={() => onNavigate(r.entityId)}
            style={{ cursor: 'pointer' }}
          >
            <span>{r.title}</span>
            <span>{r.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
