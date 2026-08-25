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
 * das später aktivierte Modul (spätere Reihenfolge sticht). Bei mehr als
 * zwei Modulen auf demselben target wird jeder Verlierer einzeln gemeldet,
 * damit die UI alle betroffenen Module benennt (keine Ketten-Reduktion).
 */
export function detectConflicts(modules: readonly ModuleSummary[]): Conflict[] {
  // target → alle Module in Aktivierungs-Reihenfolge, die es berühren.
  const touched = new Map<string, string[]>();
  for (const mod of modules) {
    for (const entry of mod.overrides) {
      const list = touched.get(entry.target);
      if (list) list.push(mod.id);
      else touched.set(entry.target, [mod.id]);
    }
  }
  const conflicts: Conflict[] = [];
  for (const [target, ids] of touched) {
    if (ids.length < 2) continue;
    const winner = ids[ids.length - 1];
    for (let i = 0; i < ids.length - 1; i += 1) {
      if (ids[i] === winner) continue;
      conflicts.push({ target, winner, loser: ids[i] });
    }
  }
  return conflicts;
}

// Kern-Grammatik-Präfixe der Regel-Substrate (M9 / EPIC-019). Die konkrete
// ID-Registry liegt beim Base-System-Plugin (dnd5e_srd, S08); default hier
// erkennt nur die Kategorie-Namen — unbekannte Präfixe → Ladefehler.
// `hook:` ist der Event-Hook-Kanal (z.B. hook:crit_damage) — Plugins können
// darüber Regel-Ableitungen ändern (S08 max_crit_damage).
const KNOWN_TARGET_PREFIXES = [
  'bands:', 'transition:', 'roll_target:', 'resource:', 'success_bands:', 'hook:',
];

/**
 * Modul zeigt auf einen target-Prefix, der nicht Teil des bekannten
 * Regel-Substrats ist → Ladefehler mit Modul-ID + Target-ID. Optional
 * kann eine `knownIds`-Menge übergeben werden (aus der Basis-System-
 * Registry, S08); dann wird zusätzlich Existenz statt nur Prefix geprüft.
 * Der Consumer rendert die Meldung als StatusChip/Panel (kein alert()).
 */
export function validateModuleTargets(
  mod: ModuleWithBase,
  knownIds?: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  for (const entry of mod.overrides) {
    const known = KNOWN_TARGET_PREFIXES.some((p) => entry.target.startsWith(p));
    if (!known) {
      errors.push(`Modul "${mod.id}" (Basis: ${mod.overlays}) verweist auf unbekannte Ziel-ID: ${entry.target}`);
      continue;
    }
    if (knownIds !== undefined && !knownIds.has(entry.target)) {
      errors.push(`Modul "${mod.id}" (Basis: ${mod.overlays}) referenziert nicht-existente Ziel-ID: ${entry.target}`);
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
