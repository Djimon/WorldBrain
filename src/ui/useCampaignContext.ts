// #415: single source for "which campaign am I editing in?". The campaign context is
// active only when a DM runs a live campaign in play mode. Outside that (edit mode / world
// author, or a player) there is no campaign and creates/edits target the world base.
import { useAppMode } from './AppModeContext';

/** The active campaign id, or `undefined` when not in a DM-play campaign context. */
export function useCampaignContext(): string | undefined {
  const { mode, sessionRole, activeSessionId } = useAppMode();
  return mode === 'play' && sessionRole === 'dm' && activeSessionId !== null ? activeSessionId : undefined;
}
