// #390 — remembered play context (campaign + role) per project. Enables the
// quick edit⟷play switch: once chosen, "Edit → Play" re-enters
// the context directly, without another "campaign + role" step.
//
// Persistence analogous to src/theme.ts via localStorage (per-window, survives restart).
// AP-006: localStorage/JSON.parse at the load boundary with a safe fallback.
export type PlaySessionRole = 'dm' | 'player';

export interface PlayContext {
  campaignId: string;
  role: PlaySessionRole;
}

const keyFor = (projectId: string): string => `wbx:playContext:${projectId}`;

/** Read the project's remembered play context — `null` if none/invalid. */
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
    return null; // corrupted entry → treated as "no context"
  }
}

/** Remember the project's play context (after role/campaign choice). */
export function setPlayContext(projectId: string, ctx: PlayContext): void {
  try {
    localStorage.setItem(keyFor(projectId), JSON.stringify(ctx));
  } catch {
    /* storage unavailable — not critical, the context then lives only in state */
  }
}

/** Clear the remembered context ("leave session") → the next play switch asks again. */
export function clearPlayContext(projectId: string): void {
  try {
    localStorage.removeItem(keyFor(projectId));
  } catch {
    /* ignore */
  }
}
