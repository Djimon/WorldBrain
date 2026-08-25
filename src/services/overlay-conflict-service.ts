// M13-S06 (#241): Konflikt-Erkennung + Validierungs-Warnungen für die
// aktivierten House-Rule-Overlays. Reine Datenverarbeitung — die Ergebnisse
// werden von der Modul-Bibliothek-UI (S07) angezeigt.

export type Op = 'patch' | 'replace' | 'remove';

export interface OverlayEntry {
  target: string;
  op: Op;
  value: unknown;
}

export interface ModuleSummary {
  id: string;
  overrides: readonly OverlayEntry[];
}

export interface ModuleWithBase extends ModuleSummary {
  /** Basis-System, dessen IDs dieses Modul patcht (z.B. 'dnd5e_srd'). */
  overlays: string;
}

export interface Conflict {
  target: string;
  winner: string;
  loser: string;
}

/**
 * Konflikt = zwei aktive Module berühren dasselbe target. Der Gewinner ist
 * das später aktivierte Modul (spätere Reihenfolge sticht — passt zum
 * Standard-Overlay-Stack).
 */
export function detectConflicts(modules: readonly ModuleSummary[]): Conflict[] {
  const first = new Map<string, string>();
  const conflicts: Conflict[] = [];
  for (const mod of modules) {
    for (const entry of mod.overrides) {
      const prev = first.get(entry.target);
      if (prev !== undefined && prev !== mod.id) {
        conflicts.push({ target: entry.target, winner: mod.id, loser: prev });
      }
      first.set(entry.target, mod.id);
    }
  }
  return conflicts;
}

// Kern-Grammatik-Präfixe der Regel-Substrate (M9 / EPIC-019). Die konkrete
// ID-Registry liegt beim Base-System-Plugin (dnd5e_srd, S08); default hier
// erkennt nur die Kategorie-Namen — unbekannte Präfixe → Ladefehler.
const KNOWN_TARGET_PREFIXES = ['bands:', 'transition:', 'roll_target:', 'resource:', 'success_bands:'];

/**
 * Modul zeigt auf einen target-Prefix, der nicht Teil des bekannten
 * Regel-Substrats ist → Ladefehler mit Modul-ID + Target-ID. Der Consumer
 * rendert die Meldung als StatusChip/Panel (kein alert()).
 */
export function validateModuleTargets(mod: ModuleWithBase): string[] {
  const errors: string[] = [];
  for (const entry of mod.overrides) {
    const known = KNOWN_TARGET_PREFIXES.some((p) => entry.target.startsWith(p));
    if (!known) {
      errors.push(`Modul "${mod.id}" (Basis: ${mod.overlays}) verweist auf unbekannte Ziel-ID: ${entry.target}`);
    }
  }
  return errors;
}

export interface DiffEntry {
  target: string;
  op: Op;
}

/**
 * „Was überschreibt dieses Modul": Liste aller (target, op)-Paare für die
 * Diff-Vorschau in der Bibliothek-UI (S07).
 */
export function moduleDiff(mod: ModuleSummary): DiffEntry[] {
  return mod.overrides.map((e) => ({ target: e.target, op: e.op }));
}
