// M14-S13: Konsum — Entity-Status am Kalender-Tag (#268)
// Visible proof of the derived world-state projection (S10): shows an
// entity's status at a given (active calendar) day via entityStatusAt.
// Read-only/projected — never writes to the database.
import { useEffect, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { entityStatusAt } from '../services/world-state-projection';

export interface EntityStatusBadgeProps {
  database: DatabaseLike;
  entityId: string;
  day: number;
}

export function EntityStatusBadge({ database, entityId, day }: EntityStatusBadgeProps) {
  const [status, setStatus] = useState<unknown>(undefined);

  useEffect(() => {
    entityStatusAt(database, entityId, day).then(setStatus).catch(console.error);
  }, [database, entityId, day]);

  if (status === undefined) return null;
  return <span className="entity-status-badge">{String(status)}</span>;
}
