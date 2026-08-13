// M10-S05 (#199): Player-Join-Flow — Erst-Join + Reconnect-Einstieg.
// Zeigt URL/Code/Name-Formular → pending-Status → approved/rejected.
// Kein Session-Inhalt vor approved (D11). Datenquelle = Host-API, nie lokale DB.
// AP-003: kein prompt/alert/confirm; alle Strings per useTranslation.
export interface PlayerJoinViewProps {
  onJoined?: (token: string) => void;
}

export function PlayerJoinView(_props: PlayerJoinViewProps): React.ReactElement {
  throw new Error('not implemented');
}

export default PlayerJoinView;
