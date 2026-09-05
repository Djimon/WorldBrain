// M10-#432 (refactor): the play-mode presentation surface, extracted from WorkspaceShell.
// It gates on the player join handshake, then mounts the view-independent play chrome
// (persistent session bar #425, opt-in focus drop-in #426) around the shared views.
// `renderArea()` STAYS in the shell and is passed in as `children` — this component never
// duplicates it. In edit mode the play chrome is hidden (mode gates), so it just renders
// the children — i.e. this is also the normal edit content path.
import type { ReactNode } from 'react';
import type { AppMode, SessionRole } from './AppModeContext';
import type { Area } from './WorkspaceShell';
import type { DatabaseLike } from '../services/entity-service';
import type { PlayClientStoreImpl } from '../services/play-client-store';
import type { WebRtcTransport } from '../services/webrtc-transport';
import { SessionTimeBar } from './SessionTimeBar';
import { FocusDropIn } from './FocusDropIn';
import { PlayerJoinView } from './PlayerJoinView';

export interface PlaySurfaceProps {
  playerNeedsJoin: boolean;
  onLeave: () => void;
  onPlayerJoined: (result: { token: string; playerId: string; displayName: string; transport?: WebRtcTransport }) => void;
  mode: AppMode;
  sessionRole: SessionRole;
  activeSessionId: string | null;
  database: DatabaseLike;
  /** #425: bumped by the DM's SessionTimeControls (lobby) so the bar re-reads. */
  sessionTimeToken: number;
  playerStore: PlayClientStoreImpl | null;
  activeArea: Area;
  onFocusJump: () => void;
  /** renderArea() output — stays owned by the shell, never duplicated here. */
  children: ReactNode;
}

export function PlaySurface({
  playerNeedsJoin, onLeave, onPlayerJoined, mode, sessionRole, activeSessionId,
  database, sessionTimeToken, playerStore, activeArea, onFocusJump, children,
}: PlaySurfaceProps) {
  // M10-S05 (#387) / #420 (S1): an un-joined player starts with the DB-less join handshake.
  // This gate replaces the old cockpit-area join branch; once joined, the player sees the
  // normal play-sidebar views via renderArea(). onCancel restores the pre-#420 way out
  // (leave the join surface → clearPlayContext + back to edit), avoiding a dead-end when a
  // remembered player context has no reachable host.
  if (playerNeedsJoin) {
    return <PlayerJoinView onCancel={onLeave} onJoined={onPlayerJoined} />;
  }
  return (
    <>
      {/* #425 (S6): the persistent session bar (date + time-of-day, DISPLAY ONLY) is mounted
          OUTSIDE renderArea() so it stays visible across every play-sidebar view switch.
          Play mode only, once a campaign is active. */}
      {mode === 'play' && activeSessionId !== null && (
        <SessionTimeBar database={database} campaignId={activeSessionId} refreshToken={sessionTimeToken} />
      )}
      {/* #426 (S7): the opt-in focus drop-in — player only, view-independent. Never
          auto-switches the view; the player clicks it to jump to the DM's focus. */}
      {mode === 'play' && sessionRole === 'player' && (
        <FocusDropIn store={playerStore} activeArea={activeArea} focusArea="maps" onJump={onFocusJump} />
      )}
      {children}
    </>
  );
}

export default PlaySurface;
