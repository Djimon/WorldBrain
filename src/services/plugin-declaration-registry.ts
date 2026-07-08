// M9-S11: stable declaration IDs & registry (#244)
// Overlay-resolver addressing surface (EPIC-019, #238) targets these IDs.
// Pure additive refactor over the already-loaded M9 declarations (field/
// formula/table) — no change to how they're evaluated (formula-engine.ts /
// condition-engine.ts are untouched).
//
// M12-Decision 12 (#226): the same scheme covers the Resolution/Resource
// layer's descriptors (roll, bands, resource, transition, hook, modifier) —
// 'roll' added here (M12-S01); S02-S10 add their own kinds to this union as
// they land, never a parallel registry.

export type DeclarationKind = 'field' | 'formula' | 'table' | 'roll' | 'bands' | 'resource' | 'transition';

export function makeStableId(kind: DeclarationKind, name: string): string {
  if (name.includes(':')) {
    throw new Error(`Invalid declaration name (contains ":"): ${name}`);
  }
  return `${kind}:${name}`;
}

const _registry: Record<string, Record<string, unknown>> = {};

export function registerDeclaration(pluginId: string, kind: DeclarationKind, name: string, value: unknown): void {
  const stableId = makeStableId(kind, name);
  const plugin = (_registry[pluginId] ??= {});
  if (Object.prototype.hasOwnProperty.call(plugin, stableId)) {
    // Mirrors registerPluginEntityType/registerPluginRelationType in
    // plugin-entity-service.ts: warn + "second definition wins" — not a
    // silent overwrite with zero signal.
    console.warn(`Plugin declaration conflict: "${stableId}" already registered for "${pluginId}". Second definition wins.`);
  }
  plugin[stableId] = value;
}

export function getDeclaration(pluginId: string, stableId: string): unknown {
  return _registry[pluginId]?.[stableId];
}

export function listDeclarationIds(pluginId: string): string[] {
  return Object.keys(_registry[pluginId] ?? {});
}

export function clearRegistry(pluginId: string): void {
  delete _registry[pluginId];
}

export function validateNoDuplicateDeclarations(
  declarations: { kind: DeclarationKind; name: string }[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const { kind, name } of declarations) {
    // #248: reuse makeStableId — single source for the id format/guard,
    // instead of duplicating the "kind:name" template (and its ":" guard).
    const stableId = makeStableId(kind, name);
    if (seen.has(stableId)) {
      errors.push(`Duplicate declaration: ${stableId}`);
    }
    seen.add(stableId);
  }
  return errors;
}
