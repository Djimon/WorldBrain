// M14-S13: Konsum — Entity-Status am Kalender-Tag (#268)
// Visible proof of the derived world-state projection (S10): shows an
// entity's status at a given (active calendar) day via entityStatusAt.
// Read-only/projected — never writes to the database.
import type { DatabaseLike } from '../services/entity-service';

export interface EntityStatusBadgeProps {
  database: DatabaseLike;
  entityId: string;
  day: number;
}

export function EntityStatusBadge(_props: EntityStatusBadgeProps): never {
  throw new Error('not implemented');
}
