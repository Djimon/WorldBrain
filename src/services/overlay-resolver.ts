// M13-S03: Overlay-Resolver (Basis ⊕ aktive Module) (#238)
// Reuses applyOverrideEntry (override-entry.ts) for patch/replace/add/remove
// semantics — no parallel merge logic. Output is the same declaration-map
// shape as a base plugin's registered declarations, so M9/M12 engines stay
// overlay-agnostic (they never know an overlay was involved).
import { applyOverrideEntry, type OverrideEntry } from './override-entry';

export interface OverlayModule {
  id: string;
  overrides: OverrideEntry[];
}

export interface OverlayResolution {
  effective: Record<string, unknown>;
  conflicts: string[];
}

/**
 * Resolves base declarations plus an ordered stack of active overlay
 * modules into the effective declaration set: last-wins per target ID,
 * with any target touched by more than one module flagged as a conflict
 * (order still decides the winner, but the collision is surfaced).
 */
export function resolveOverlay(
  base: Record<string, unknown>,
  modules: OverlayModule[],
): OverlayResolution {
  const effective: Record<string, unknown> = { ...base };
  const touchCounts = new Map<string, number>();

  for (const module of modules) {
    for (const entry of module.overrides) {
      touchCounts.set(entry.target, (touchCounts.get(entry.target) ?? 0) + 1);
      const next = applyOverrideEntry(effective[entry.target], entry);
      if (next === undefined) {
        delete effective[entry.target];
      } else {
        effective[entry.target] = next;
      }
    }
  }

  const conflicts = [...touchCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([target]) => target);

  return { effective, conflicts };
}
