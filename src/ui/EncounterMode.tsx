// M8-S07: EncounterMode — stub, implement in GREEN phase
import type { DatabaseLike } from '../services/entity-service';

interface Encounter {
  id: string;
  title: string;
  type: string;
  linked_location: string | null;
  group: string | null;
}

export function EncounterMode(_props: {
  database: DatabaseLike;
  sessionId: string;
  encounters: Encounter[];
  onEncounterEnd: () => void;
}) {
  return <div>EncounterMode not implemented</div>;
}
