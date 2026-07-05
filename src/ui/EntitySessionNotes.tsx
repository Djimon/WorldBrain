// M8-S09: EntitySessionNotes — stub, implement in GREEN phase
import type { DatabaseLike } from '../services/entity-service';

interface Entity {
  id: string;
  name: string;
  type: string;
}

export function EntitySessionNotes(_props: {
  database: DatabaseLike;
  entity: Entity;
  sessionId: string;
  onApplyToWorld?: (args: { entityId: string; note: string }) => void;
}) {
  return <div>EntitySessionNotes not implemented</div>;
}
