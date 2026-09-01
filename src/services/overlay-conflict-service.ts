// M13-S06 (#241): Conflict detection + validation warnings for the
// activated house-rule overlays. Pure data processing — the results
// are displayed by the module-library UI (S07).

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
  /** Base system whose IDs this module patches (e.g. 'dnd5e_srd'). */
  overlays: string;
}

export interface Conflict {
  target: string;
  winner: string;
  loser: string;
}

/**
 * Conflict = two active modules touch the same target. The winner is
 * the module activated later (later order wins). With more than
 * two modules on the same target, each loser is reported individually,
 * so the UI names all affected modules (no chain reduction).
 */
export function detectConflicts(modules: readonly ModuleSummary[]): Conflict[] {
  // target → all modules touching it, in activation order.
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

// Core grammar prefixes of the rule substrates (M9 / EPIC-019). The concrete
// ID registry lives in the base-system plugin (dnd5e_srd, S08); the default here
// recognizes only the category names — unknown prefixes → load error.
// `hook:` is the event-hook channel (e.g. hook:crit_damage) — plugins can
// change rule derivations through it (S08 max_crit_damage).
const KNOWN_TARGET_PREFIXES = [
  'bands:', 'transition:', 'roll_target:', 'resource:', 'success_bands:', 'hook:',
];

/**
 * Module points to a target prefix that is not part of the known
 * rule substrate → load error with module ID + target ID. Optionally
 * a `knownIds` set can be passed (from the base-system
 * registry, S08); then existence is checked in addition to just the prefix.
 * The consumer renders the message as a StatusChip/Panel (no alert()).
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
 * "What this module overrides": list of all (target, op) pairs for the
 * diff preview in the library UI (S07).
 */
export function moduleDiff(mod: ModuleSummary): DiffEntry[] {
  return mod.overrides.map((e) => ({ target: e.target, op: e.op }));
}
