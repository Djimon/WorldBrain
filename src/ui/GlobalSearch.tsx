import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, ListRow, StatusChip } from './primitives';
import { stripMarkdown } from '../utils/markdown';
import { searchEntities, getSearchFacets, rebuildSearchIndex } from '../services/search-service';
import type { SearchResult, SearchFacets } from '../services/search-service';
import type { DatabaseLike } from '../services/entity-service';
import { EntityDetailView } from './EntityDetailView';
import { useCampaignContext } from './useCampaignContext';

interface Props {
  onNavigate: (entityId: string) => void;
  database?: DatabaseLike;
}

export function GlobalSearch({ onNavigate, database }: Props) {
  const { t } = useTranslation('nav');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [indexing, setIndexing] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  // #419: DM in a campaign also finds this campaign's campaign-created entities; results are
  // marked with the campaign name. Undefined outside a campaign → world-only search.
  const campaignId = useCampaignContext();
  const [campaignTitle, setCampaignTitle] = useState('');

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!database || !campaignId) { setCampaignTitle(''); return; }
    let cancelled = false;
    database.select<{ title: string }>('SELECT title FROM campaigns WHERE id = ?', [campaignId])
      .then((rows) => { if (!cancelled) setCampaignTitle(rows[0]?.title ?? ''); })
      .catch(() => { /* no campaigns table / not found */ });
    return () => { cancelled = true; };
  }, [database, campaignId]);

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
      getSearchFacets(database!, query, {}, results, campaignId).then(setFacets).catch(console.error);
    } else {
      setFacets(null);
    }
  }, [results, database, query, campaignId]);

  async function handleChange(value: string) {
    setQuery(value);
    setSelectedIndex(-1);
    if (!value.trim()) { setResults([]); return; }
    const res = await searchEntities(database!, value, {}, campaignId);
    setResults(res);
  }

  // Re-run the active query once the (re)index finishes, so results typed
  // during indexing are not stuck empty.
  useEffect(() => {
    if (indexing || !database || !query.trim()) return;
    searchEntities(database, query, {}, campaignId).then(setResults).catch(console.error);
  }, [indexing]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    else if (e.key === 'ArrowUp') setSelectedIndex((i) => Math.max(i - 1, 0));
    else if (e.key === 'Enter') { const item = filtered[selectedIndex] ?? filtered[0]; if (item) onNavigate(item.entityId); }
    else if (e.key === 'Escape') { setQuery(''); setResults([]); }
  }

  const filtered = activeTypeFilter ? results.filter((r) => r.entityType === activeTypeFilter) : results;
  const selectedEntityId = filtered[selectedIndex]?.entityId ?? null;

  return (
    <div className={`gsearch${selectedEntityId ? ' gsearch--split' : ''}`}>
      <div className="gsearch__bar">
        <input
          ref={inputRef}
          className="gsearch__input"
          role="searchbox"
          aria-label={t('globalSearch.aria')}
          type="search"
          value={query}
          onChange={(e) => void handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('globalSearch.placeholder')}
        />
      </div>

      {facets && Object.keys(facets.entityTypes).length > 0 && (
        <div className="gsearch__facets">
          {Object.entries(facets.entityTypes).map(([type, count]) => (
            <Chip
              key={type}
              as="button"
              variant="outline"
              selected={activeTypeFilter === type}
              onClick={() => { setActiveTypeFilter(activeTypeFilter === type ? null : type); setSelectedIndex(-1); }}
            >
              {type} <span className="gsearch__facet-count">{count}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="emd u-min-h-0">
        <div className="emd__list u-scroll-y">
          {query && filtered.length === 0 && (
            <div className="gsearch__empty">{t('globalSearch.noResults', { query })}</div>
          )}

          {!query && (
            <div className="gsearch__hint">
              {indexing ? t('globalSearch.indexing') : t('globalSearch.hint')}
            </div>
          )}

          <ul className="gsearch__results u-grow u-scroll-y" role="listbox">
            {filtered.map((r, i) => (
              <ListRow
                as="li"
                key={r.entityId}
                className="gsearch__result"
                selected={i === selectedIndex}
                role="option"
                aria-selected={i === selectedIndex}
                onClick={() => setSelectedIndex(i)}
                onDoubleClick={() => onNavigate(r.entityId)}
              >
                <span className="gsearch__result-title">{r.title}</span>
                <span className="gsearch__result-type">{r.entityType}</span>
                {r.campaignId && (
                  <StatusChip tone="accent">{t('globalSearch.campaignBadge', { name: campaignTitle || r.campaignId })}</StatusChip>
                )}
                {r.summary && <span className="gsearch__result-summary">{stripMarkdown(r.summary)}</span>}
              </ListRow>
            ))}
          </ul>
        </div>

        {selectedEntityId && database && (
          <div className="emd__detail">
            <EntityDetailView
              entityId={selectedEntityId}
              database={database}
              onNavigateToEntity={onNavigate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
