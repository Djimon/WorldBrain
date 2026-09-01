// M10-S23 (#346): derived readOnly flag for read-only player gating (D25).
// Single source of truth via the AppModeContext — no duplicated
// `mode==='play' && role==='player'` scattered across individual components.
import { useAppMode } from './AppModeContext';

/**
 * `true` when the app runs in play mode as a player — then all
 * world-content edit affordances (create/edit/delete buttons and menus) in
 * the play-subset areas are hidden. Player-owned actions (own character
 * sheet, own token, dice rolls, private notes — D14/D18) are not
 * affected; they are NOT world content.
 */
export function useReadOnly(): boolean {
  const { mode, sessionRole } = useAppMode();
  return mode === 'play' && sessionRole === 'player';
}
