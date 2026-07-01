export interface EntityTypeDef {
  id: string;
  displayNameKey: string;
}

export const ENTITY_TYPE_DEFS: EntityTypeDef[] = [
  { id: 'Character', displayNameKey: 'entity:type.character' },
  { id: 'Location',  displayNameKey: 'entity:type.location' },
  { id: 'Faction',   displayNameKey: 'entity:type.faction' },
  { id: 'Item',      displayNameKey: 'entity:type.item' },
  { id: 'Quest',     displayNameKey: 'entity:type.quest' },
  { id: 'Event',     displayNameKey: 'entity:type.event' },
  { id: 'Scene',     displayNameKey: 'entity:type.scene' },
  { id: 'Rule',      displayNameKey: 'entity:type.rule' },
  { id: 'Resource',  displayNameKey: 'entity:type.resource' },
  { id: 'Culture',   displayNameKey: 'entity:type.culture' },
];

export function getEntityTypeDef(id: string): EntityTypeDef | undefined {
  return ENTITY_TYPE_DEFS.find((d) => d.id === id);
}
