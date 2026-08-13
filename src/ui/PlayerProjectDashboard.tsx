// M10-S05 (#199): Dashboard mit gespeicherten Player-Projekten (App-Modus, D10).
// Persistierter Eintrag = Host-Label · URL/IP · Code · Token · Anzeigename ·
// Session-Name · zuletzt-online. Online-Erkennung = einmaliger Ping, kein Heartbeat.
// AP-003; alle Strings useTranslation.
export interface PlayerProject {
  id: string;
  label: string;
  hostUrl: string;
  inviteCode: string;
  token: string;
  displayName: string;
  sessionName: string;
  lastSeenAt: string | null;
}

export interface PlayerProjectDashboardProps {
  onJoinNew?: () => void;
  onOpenProject?: (project: PlayerProject) => void;
}

export function PlayerProjectDashboard(_props: PlayerProjectDashboardProps): React.ReactElement {
  throw new Error('not implemented');
}

export default PlayerProjectDashboard;
