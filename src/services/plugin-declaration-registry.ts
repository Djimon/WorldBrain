// M9-S11: stable declaration IDs & registry — stub, implement in GREEN phase (#244)
// Overlay-resolver addressing surface (EPIC-019, #238) targets these IDs.

export type DeclarationKind = 'field' | 'formula' | 'table';

export function makeStableId(kind: DeclarationKind, name: string): string {
  return `${kind}:${name}`;
}

export function registerDeclaration(_pluginId: string, _kind: DeclarationKind, _name: string, _value: unknown): void {
  throw new Error('not implemented');
}

export function getDeclaration(_pluginId: string, _stableId: string): unknown {
  throw new Error('not implemented');
}

export function listDeclarationIds(_pluginId: string): string[] {
  throw new Error('not implemented');
}

export function clearRegistry(_pluginId: string): void {
  throw new Error('not implemented');
}

export function validateNoDuplicateDeclarations(
  _declarations: { kind: DeclarationKind; name: string }[],
): string[] {
  throw new Error('not implemented');
}
