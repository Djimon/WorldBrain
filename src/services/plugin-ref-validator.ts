// M9-S08: reference field type validation (EPIC-014 decision 14)
// Validates that `ref`/`ref[]` schema fields point to a known entity type
// (plugin or core). Embedded-instance fields ({ref, qty, equipped, ...})
// reuse the `ref[]` type with additional instance metadata — the `target`
// is validated the same way.

interface RefFieldDef {
  type: string;
  target?: string;
  instance?: Record<string, string>;
}

export function validateEntityTypeRefs(
  schema: { fields?: Record<string, RefFieldDef> },
  knownEntityTypes: Set<string>,
): string[] {
  const errors: string[] = [];
  for (const [fieldName, field] of Object.entries(schema.fields ?? {})) {
    if (field.type !== 'ref' && field.type !== 'ref[]') continue;
    if (!field.target || !knownEntityTypes.has(field.target)) {
      errors.push(`Field "${fieldName}": unknown reference target "${field.target}"`);
    }
  }
  return errors;
}
