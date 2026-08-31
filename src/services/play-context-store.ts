// #390 — gemerkter Play-Kontext (Campaign + Rolle) je Projekt. Erlaubt den
// schnellen Edit⟷Play-Wechsel: einmal gewählt, betritt „Bearbeiten → Spielen"
// den Kontext direkt wieder, ohne erneuten „Campaign + Rolle"-Schritt.
//
// Persistenz analog src/theme.ts über localStorage (per-Fenster, überlebt Neustart).
// AP-006: localStorage/JSON.parse an der Lade-Grenze mit sicherem Fallback.
export type PlaySessionRole = 'dm' | 'player';

export interface PlayContext {
  campaignId: string;
  role: PlaySessionRole;
}

const keyFor = (projectId: string): string => `wbx:playContext:${projectId}`;

/** Gemerkten Play-Kontext des Projekts lesen — `null`, wenn keiner/ungültig. */
export function getPlayContext(projectId: string): PlayContext | null {
  try {
    const raw = localStorage.getItem(keyFor(projectId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PlayContext>;
    if (typeof p?.campaignId === 'string' && p.campaignId !== '' && (p.role === 'dm' || p.role === 'player')) {
      return { campaignId: p.campaignId, role: p.role };
    }
    return null;
  } catch {
    return null; // beschädigter Eintrag → wie „kein Kontext"
  }
}

/** Play-Kontext des Projekts merken (nach Rollen-/Campaign-Wahl). */
export function setPlayContext(projectId: string, ctx: PlayContext): void {
  try {
    localStorage.setItem(keyFor(projectId), JSON.stringify(ctx));
  } catch {
    /* Speicher nicht verfügbar — nicht kritisch, der Kontext lebt dann nur im State */
  }
}

/** Gemerkten Kontext löschen („Session verlassen") → nächster Play-Wechsel fragt wieder. */
export function clearPlayContext(projectId: string): void {
  try {
    localStorage.removeItem(keyFor(projectId));
  } catch {
    /* ignore */
  }
}
