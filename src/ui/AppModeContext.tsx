// M10-S22 (#342): App-Mode-Kontext (D25). Kapselt Bearbeiten/Spielen-Modus,
// Rolle (DM/Player) und die aktive Session/Campaign so, dass beliebige
// Komponenten (v.a. das Read-only-Gating aus S23) sie ohne prop-drilling
// lesen können.
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
