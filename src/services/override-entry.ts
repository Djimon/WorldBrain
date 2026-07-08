// M13-S01: Override-Entry-Modell & stabile Ziel-IDs (#236)
// Foundation for the House-Rule Overlay layer (EPIC-019 Decision 1). Target
// IDs resolve against the M9/M12 declaration registry
// (plugin-declaration-registry.ts) — no parallel addressing scheme.

import { getDeclaration } from './plugin-declaration-registry';

export type OverrideOp = 'replace' | 'patch' | 'add' | 'remove';

export interface OverrideEntry {
  target: string;
  op: OverrideOp;
  value?: unknown;
}

/**
 * Applies a single override entry to a base declaration:
 * - `patch` shallow-merges `value` fields into the base declaration.
 * - `replace` returns `value` as the whole new declaration.
 * - `add` returns `value` (base is expected to be absent).
 * - `remove` returns undefined (declaration removed).
 */
export function applyOverrideEntry(
  baseDeclaration: unknown,
  entry: OverrideEntry,
): unknown {
  switch (entry.op) {
    case 'patch':
      return { ...(baseDeclaration as Record<string, unknown> | undefined), ...(entry.value as Record<string, unknown>) };
    case 'replace':
    case 'add':
      return entry.value;
    case 'remove':
      return undefined;
  }
}

/**
 * Validates that every entry's target ID exists in the given plugin's
 * declaration registry — except `add` entries, which introduce a new ID.
 * Returns an error string per unresolvable target (Decision 6 — no silent
 * no-op on drift).
 */
export function validateOverrideTargets(
  entries: OverrideEntry[],
  basePluginId: string,
): string[] {
  const errors: string[] = [];
  for (const entry of entries) {
    if (entry.op === 'add') continue;
    if (getDeclaration(basePluginId, entry.target) === undefined) {
      errors.push(`Unknown override target: ${entry.target}`);
    }
  }
  return errors;
}
