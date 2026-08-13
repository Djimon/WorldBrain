// M10-S06 (#200): GM-Lobby — Approve/Reject/Kick, approved-Liste, Einladungscode.
// Zeigt pending-Anfragen + approved-Spieler mit Verbindungsstatus. Spieler →
// Gruppen direkt aus der Lobby zuweisbar (S04). Persistente Session (D11).
// AP-003; alle Strings useTranslation; DatabaseLike, kein unknown/as never.
import type { DatabaseLike } from '../services/entity-service';

export interface LobbyPanelProps {
  database: DatabaseLike;
  sessionId: string;
  onStartHosting?: () => void;
  onStopHosting?: () => void;
}

export function LobbyPanel(_props: LobbyPanelProps): React.ReactElement {
  throw new Error('not implemented');
}

export default LobbyPanel;
