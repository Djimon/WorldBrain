export interface RelationTypeDefinition {
  relation_type: string;
  inverse_type: string;
  symmetry: 'directed' | 'symmetric';
  label: string;
  inverse_label: string;
}

export const RelationType = {
  located_in: 'located_in',
  part_of: 'part_of',
  ranks_above: 'ranks_above',
  ally_of: 'ally_of',
  enemy_of: 'enemy_of',
  blood_relative: 'blood_relative',
  owns: 'owns',
  knows_secret: 'knows_secret',
  connected_to: 'connected_to',
} as const;

const DEFINITIONS: RelationTypeDefinition[] = [
  { relation_type: 'located_in',    inverse_type: 'contains',         symmetry: 'directed',  label: 'located in',    inverse_label: 'contains' },
  { relation_type: 'part_of',       inverse_type: 'has_part',         symmetry: 'directed',  label: 'part of',       inverse_label: 'has part' },
  { relation_type: 'ranks_above',   inverse_type: 'ranks_below',      symmetry: 'directed',  label: 'ranks above',   inverse_label: 'ranks below' },
  { relation_type: 'ally_of',       inverse_type: 'ally_of',          symmetry: 'symmetric', label: 'ally of',       inverse_label: 'ally of' },
  { relation_type: 'enemy_of',      inverse_type: 'enemy_of',         symmetry: 'symmetric', label: 'enemy of',      inverse_label: 'enemy of' },
  { relation_type: 'blood_relative', inverse_type: 'blood_relative',  symmetry: 'symmetric', label: 'blood relative', inverse_label: 'blood relative' },
  { relation_type: 'owns',          inverse_type: 'owned_by',         symmetry: 'directed',  label: 'owns',          inverse_label: 'owned by' },
  { relation_type: 'knows_secret',  inverse_type: 'secret_known_by',  symmetry: 'directed',  label: 'knows secret of', inverse_label: 'secret known by' },
  { relation_type: 'connected_to',  inverse_type: 'connected_to',     symmetry: 'symmetric', label: 'connected to',  inverse_label: 'connected to' },
];

const REGISTRY = new Map<string, RelationTypeDefinition>(
  DEFINITIONS.map((d) => [d.relation_type, d])
);

export function getRelationTypeDefinition(type: string): RelationTypeDefinition | undefined {
  return REGISTRY.get(type);
}

export function getAllRelationTypes(): RelationTypeDefinition[] {
  return DEFINITIONS;
}
