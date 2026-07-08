// M12-S06: Typisierte Tabellen-Zellen & parametrisierter Lookup — stub,
// implement in GREEN phase (#231). Extends M9-S07/S10 lookup: a cell may be
// { type: 'scalar' | 'dice', value }, and the lookup key may come from an
// externally supplied parameter (e.g. incoming_damage) instead of an
// entity's own field. 1D/2D lookup (M9-S07/S10) stay fully usable unchanged.

export interface TypedTableCell {
  type: 'scalar' | 'dice';
  value: number | string;
}

/**
 * Resolves a typed cell from a table by key (same threshold/exact semantics
 * as resolveLookup). Works whether the key is an entity field's value or an
 * externally supplied parameter — the caller decides where the key comes
 * from. Missing table/no qualifying key → null, never throws.
 */
export function resolveTypedCell(
  _table: Record<string, TypedTableCell>,
  _key: number,
  _mode: 'threshold' | 'exact',
): TypedTableCell | null {
  throw new Error('not implemented');
}
