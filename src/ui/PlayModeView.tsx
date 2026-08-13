// M10-S14 (#332): Play-Mode-Hauptfeld — Reiter Map / Kampflog / Spotlight +
// Free-Browse. DM + Spieler sehen beide den Kampflog. DM-only-Bereiche
// (Authoring, Graph, Soundboard) nicht sichtbar für Spieler (D15). AP-003.
import type { DatabaseLike } from '../services/entity-service';

export type PlayModeRole = 'dm' | 'player';

export interface PlayModeViewProps {
  database: DatabaseLike;
  sessionId: string;
  role: PlayModeRole;
  playerId?: string;
}

export function PlayModeView(_props: PlayModeViewProps): React.ReactElement {
  throw new Error('not implemented');
}

export default PlayModeView;
