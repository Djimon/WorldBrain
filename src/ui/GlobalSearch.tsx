import { useState, useEffect, useRef } from 'react';
import { stripMarkdown } from '../utils/markdown';
import { searchEntities, getSearchFacets, rebuildSearchIndex } from '../services/search-service';
import type { SearchResult, SearchFacets } from '../services/search-service';
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
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [indexing, setIndexing] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // The FTS index has no incremental writers/triggers, so refresh it whenever
  // the search view mounts (or the project db changes) — picks up entities
  // created since the app started without needing a restart.
  useEffect(() => {
    if (!database) return;
    let cancelled = false;
    setIndexing(true);
    rebuildSearchIndex(database)
      .catch(console.error)
      .finally(() => { if (!cancelled) setIndexing(false); });
    return () => { cancelled = true; };
  }, [database]);

  useEffect(() => {
    if (results.length > 0) {
      getSearchFacets(database!, query, {}).then(setFacets).catch(console.error);
    } else {
      setFacets(null);
    }
  }, [results, database, query]);

  async function handleChange(value: string) {
    setQuery(value);
    setSelectedIndex(-1);
    if (!value.trim()) { setResults([]); return; }
    const res = await searchEntities(database!, value, {});
    setResults(res);
  }

  // Re-run the active query once the (re)index finishes, so results typed
  // during indexing are not stuck empty.
  useEffect(() => {
    if (indexing || !database || !query.trim()) return;
    searchEntities(database, query, {}).then(setResults).catch(console.error);
  }, [indexing]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    else if (e.key === 'ArrowUp') setSelectedIndex((i) => Math.max(i - 1, 0));
    else if (e.key === 'Enter') { const item = filtered[selectedIndex] ?? filtered[0]; if (item) onNavigate(item.entityId); }
    else if (e.key === 'Escape') { setQuery(''); setResults([]); }
  }

  const filtered = activeTypeFilter ? results.filter((r) => r.entityType === activeTypeFilter) : results;

  return (
    <div className="gsearch">
      <div className="gsearch__bar">
        <input
          ref={inputRef}
          className="gsearch__input"
          role="searchbox"
          aria-label="Entities suchen"
          type="search"
          value={query}
          onChange={(e) => void handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Entities suchen… (Ctrl+K)"
        />
      </div>

      {facets && Object.keys(facets.entityTypes).length > 0 && (
        <div className="gsearch__facets">
          {Object.entries(facets.entityTypes).map(([type, count]) => (
            <button
              key={type}
              className={`gsearch__facet${activeTypeFilter === type ? ' gsearch__facet--active' : ''}`}
              onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
            >
              {type} <span className="gsearch__facet-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {query && filtered.length === 0 && (
        <div className="gsearch__empty">Keine Ergebnisse für „{query}"</div>
      )}

      {!query && (
        <div className="gsearch__hint">
          {indexing ? 'Index wird aktualisiert…' : 'Tippe um Entities, Orte, Fraktionen u.v.m. zu suchen.'}
        </div>
      )}

      <ul className="gsearch__results" role="listbox">
        {filtered.map((r, i) => (
          <li
            key={r.entityId}
            className={`gsearch__result${i === selectedIndex ? ' gsearch__result--selected' : ''}`}
            role="option"
            aria-selected={i === selectedIndex}
            onClick={() => onNavigate(r.entityId)}
          >
            <span className="gsearch__result-title">{r.title}</span>
            <span className="gsearch__result-type">{r.entityType}</span>
            {r.summary && <span className="gsearch__result-summary">{stripMarkdown(r.summary)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
