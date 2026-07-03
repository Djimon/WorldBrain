// M9-S05: Spell / Item / Feat / Species Schemas (EPIC-014)
// Validates system-plugin-provided entity objects against their required-field
// schema, dispatched on the entity `type`. Produces no HTML — free-text fields
// (descriptions, dice expressions) are handled by consumers (dice-link-layer,
// React escaping).

export interface SystemEntityValidationResult {
  valid: boolean;
  errors?: string[];
}

// Required fields per system entity type. Optional/nullable fields
// (damage_expression, prerequisite, subspecies, …) are intentionally absent.
const REQUIRED_FIELDS: Record<string, string[]> = {
  spell: ['id', 'name', 'level'],
  item: ['id', 'name', 'item_type'],
  feat: ['id', 'name'],
  species: ['id', 'name'],
};

export function validateSystemEntity(entity: object): SystemEntityValidationResult {
  const e = entity as Record<string, unknown>;
  const type = typeof e.type === 'string' ? e.type : '';
  const required = REQUIRED_FIELDS[type];

  if (!required) {
    return { valid: false, errors: [`Unknown system entity type: ${type || '(none)'}`] };
  }

  const errors: string[] = [];
  for (const field of required) {
    // Missing (undefined) or null → invalid. Falsy-but-present values such as
    // level 0 (cantrip) remain valid.
    if (e[field] === undefined || e[field] === null) {
      errors.push(`${type}: missing required field '${field}'`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}
