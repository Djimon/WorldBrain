// M10-S22 (#342): App-Mode context (D25). Encapsulates edit/play mode,
// role (DM/Player) and the active session/campaign so that arbitrary
// components (esp. the read-only gating from S23) can read them without
// prop-drilling.
import { createContext, useContext } from 'react';

export type AppMode = 'edit' | 'play';
export type SessionRole = 'dm' | 'player' | null;

export interface AppModeContextValue {
  mode: AppMode;
  sessionRole: SessionRole;
  activeSessionId: string | null;
}

const DEFAULT: AppModeContextValue = {
  mode: 'edit',
  sessionRole: null,
  activeSessionId: null,
};

export const AppModeContext = createContext<AppModeContextValue>(DEFAULT);

export function useAppMode(): AppModeContextValue {
  return useContext(AppModeContext);
}
