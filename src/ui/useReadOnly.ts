// M10-S23 (#346): abgeleitetes readOnly-Flag für Read-only Player-Gating (D25).
// Single Source of Truth über den AppModeContext — nirgends dupliziertes
// `mode==='play' && role==='player'` verstreut in einzelnen Komponenten.
import { useAppMode } from './AppModeContext';

/**
 * `true`, wenn die App im Spielen-Modus als Player läuft — dann werden alle
 * Welt-Inhalts-Edit-Affordances (Create/Edit/Delete-Buttons und -Menüs) in
 * den Play-Subset-Bereichen ausgeblendet. Spielereigene Aktionen (eigener
 * Bogen, eigener Token, Würfeln, private Notizen — D14/D18) sind davon
 * nicht betroffen; sie sind KEINE Welt-Inhalte.
 */
export function useReadOnly(): boolean {
  const { mode, sessionRole } = useAppMode();
  return mode === 'play' && sessionRole === 'player';
}
