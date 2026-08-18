import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { ListRow } from './primitives';
import { parseMentions } from './PropertiesForm';

interface Backlink { id: string; type: string; title: string }

interface Props {
  entityId: string;
  database: DatabaseLike;
  onNavigate?: (id: string) => void;
}

interface Row { id: string; type: string; title: string; summary: string; properties_json: string }

/**
 * Lists every entity that mentions this one via an @[Name](id) link in its
 * summary or any property (reverse of the mention system). Click a row to
 * jump to that entity.
 */
export function BacklinksTab({ entityId, database, onNavigate }: Props) {
  const { t } = useTranslation('entity');
  const [links, setLinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Coarse LIKE prefilter on the stored mention form `@[Name](id)`; the
    // precise id match is verified with parseMentions below.
    const pattern = `%](${entityId})%`;
    database.select<Row>(
      `SELECT id, type, title, summary, properties_json FROM base_entities
       WHERE (summary LIKE ? OR properties_json LIKE ?) AND id != ?
       ORDER BY title`,
      [pattern, pattern, entityId],
    ).then((rows) => {
      const matches = rows
        .filter((r) =>
          [...parseMentions(r.summary ?? ''), ...parseMentions(r.properties_json ?? '')]
            .some((p) => p.type === 'mention' && p.id === entityId),
        )
        .map((r) => ({ id: r.id, type: r.type, title: r.title }));
      setLinks(matches);
    }).catch(console.error).finally(() => setLoading(false));
  }, [database, entityId]);

  if (loading) return <div className="backlinks__empty">{t('backlinks.loading', 'Lade…')}</div>;
  if (links.length === 0) return <div className="backlinks__empty">{t('backlinks.empty', 'Keine Verlinkungen.')}</div>;

  return (
    <ul className="backlinks">
      {links.map((l) => (
        <li key={l.id}>
          <ListRow variant="card" className="u-justify-between backlinks__item" onClick={() => onNavigate?.(l.id)} title={t('backlinks.jump', 'Zur Entity springen')}>
            <span className="backlinks__title">{l.title}</span>
            <span className="backlinks__type">{l.type}</span>
          </ListRow>
        </li>
      ))}
    </ul>
  );
}
