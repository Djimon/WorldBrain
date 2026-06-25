import { listCardTemplates } from '../services/card-service';
import { getEffectiveEntity } from '../services/entity-service';
import type { DatabaseLike } from '../services/entity-service';

interface Props {
  templateId: string;
  entityId: string;
  database: DatabaseLike;
  overflowMap?: Record<string, string>;
  summaryMissing?: boolean;
  themeColor?: string;
}

export function CardPreview({ templateId, entityId, database, overflowMap, summaryMissing, themeColor }: Props) {
  const templates = listCardTemplates(database);
  const tpl = templates.find((t) => t.id === templateId);
  const sizeMm = tpl ? (JSON.parse(tpl.size_mm) as { width_mm: number; height_mm: number }) : { width_mm: 63, height_mm: 88 };
  const aspect = sizeMm.width_mm / sizeMm.height_mm;

  const entityResult = getEffectiveEntity({ database, entityId });
  const entity = entityResult.found ? entityResult.entity : null;

  const style: React.CSSProperties = {
    width: `${Math.round(aspect * 200)}px`,
    height: '200px',
    border: '1px solid #ccc',
    backgroundColor: themeColor ?? '#fff',
    position: 'relative',
  };

  return (
    <div style={style} aria-label="card-preview">
      <div>{entity ? (entity as Record<string, unknown>).title as string : 'preview'}</div>
      {overflowMap &&
        Object.entries(overflowMap).map(([field, status]) => (
          <span key={field} data-overflow={status}>
            {status}
          </span>
        ))}
      <button disabled={!!summaryMissing}>Export</button>
    </div>
  );
}
