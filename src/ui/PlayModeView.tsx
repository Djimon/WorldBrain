// M10-S22 (#342): Play-Cockpit. Rollen-abhängige Sicht:
//  - DM  → Cockpit-Container (Reiter Map/Kampflog/Spotlight werden von
//    S14 #360 gefüllt) + eingehängte GM-Lobby (S06).
//  - Player → PlayerJoinView im WorkspaceShell (S05); hier nicht relevant.
import { useDatabase } from '../services/DatabaseContext';
import { LobbyPanel } from './LobbyPanel';
import type { SessionRole } from './AppModeContext';

export interface PlayModeViewProps {
  role: SessionRole;
  activeSessionId: string | null;
}

export function PlayModeView({ role, activeSessionId }: PlayModeViewProps) {
  const database = useDatabase();
  // M10-S06: Lobby ist Teil des DM-Cockpits (Roster/Kick/Invite-Code).
  // S14 baut Map/Kampflog/Spotlight-Reiter drum herum.
  const campaignId = activeSessionId ?? '';
  return (
    <div className="workspace-area play-cockpit" data-play-role={role ?? ''}
      data-session-id={activeSessionId ?? ''}>
      {role === 'dm' && campaignId !== '' && (
        <LobbyPanel database={database} campaignId={campaignId} />
      )}
    </div>
  );
}

export default PlayModeView;
