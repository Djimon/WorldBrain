// M10-S22 (#342): Play-Cockpit-Stub.
// Wird von S14 (#360) mit Map/Kampflog/Spotlight-Reitern + Free-Browse
// ausgebaut. Hier nur der Mount-Punkt, damit S22 (App-Mode-Shell)
// unabhängig von S14 grün werden kann.
import type { SessionRole } from './AppModeContext';

export interface PlayModeViewProps {
  role: SessionRole;
  activeSessionId: string | null;
}

export function PlayModeView({ role, activeSessionId }: PlayModeViewProps) {
  return (
    <div className="workspace-area play-cockpit" data-play-role={role ?? ''}
      data-session-id={activeSessionId ?? ''}>
      <p>Play-Cockpit — Rolle: {role ?? '—'}</p>
    </div>
  );
}

export default PlayModeView;
