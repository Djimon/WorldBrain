type FieldSchema = {
  type: 'string' | 'boolean' | 'number' | 'array';
  enum?: string[];
  items?: { type: 'string' };
  required?: boolean;
  title?: string;
};

export type EntityTypeSchema = {
  properties: Record<string, FieldSchema>;
};

// #402: field `title` values are the ENGLISH data-model fallback. The German
// display comes from the i18n layer (#399: t('prop.'+field.id, { ns:'entity',
// defaultValue: title })). `key`s and enum codes are already English — unchanged.
export const ENTITY_TYPE_SCHEMAS: Record<string, EntityTypeSchema> = {
  Character: {
    properties: {
      status:      { type: 'string', enum: ['alive', 'dead', 'unknown', 'missing'], title: 'Status' },
      race:        { type: 'string', title: 'Race / Species' },
      class:       { type: 'string', title: 'Class / Profession' },
      alignment:   { type: 'string', enum: ['LG','NG','CG','LN','TN','CN','LE','NE','CE',''], title: 'Alignment' },
      age:         { type: 'number', title: 'Age' },
      affiliation: { type: 'string', title: 'Affiliation' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
  Location: {
    properties: {
      type:        { type: 'string', enum: ['city', 'village', 'dungeon', 'wilderness', 'building', 'plane', 'region', ''], title: 'Type' },
      climate:     { type: 'string', title: 'Climate' },
      population:  { type: 'string', title: 'Population' },
      ruler:       { type: 'string', title: 'Ruler' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
  Faction: {
    properties: {
      type:        { type: 'string', enum: ['guild', 'religion', 'government', 'military', 'criminal', 'secret', ''], title: 'Type' },
      alignment:   { type: 'string', enum: ['LG','NG','CG','LN','TN','CN','LE','NE','CE',''], title: 'Alignment' },
      size:        { type: 'string', enum: ['tiny', 'small', 'medium', 'large', 'massive', ''], title: 'Size' },
      leader:      { type: 'string', title: 'Leader' },
      headquarters:{ type: 'string', title: 'Headquarters' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
  Item: {
    properties: {
      type:        { type: 'string', enum: ['weapon', 'armor', 'tool', 'artifact', 'consumable', 'misc', ''], title: 'Type' },
      rarity:      { type: 'string', enum: ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', ''], title: 'Rarity' },
      value:       { type: 'string', title: 'Value' },
      weight:      { type: 'number', title: 'Weight (kg)' },
      attunement:  { type: 'boolean', title: 'Attunement Required' },
      owner:       { type: 'string', title: 'Owner' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
  Quest: {
    properties: {
      status:      { type: 'string', enum: ['active', 'completed', 'failed', 'on hold', ''], title: 'Status' },
      giver:       { type: 'string', title: 'Quest Giver' },
      reward:      { type: 'string', title: 'Reward' },
      difficulty:  { type: 'string', enum: ['trivial', 'easy', 'medium', 'hard', 'deadly', ''], title: 'Difficulty' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
  Event: {
    // #292: EntityDetailView renders EventFormFields + EffectEditor directly
    // for type='Event' — those dedicated components are the source of truth
    // for Event's fields now, not this generic scalar schema (which the
    // generic PropertiesForm branch is never reached for Event anymore).
    // Left empty rather than removed so getSchemaForType('Event') still
    // returns a valid (empty) schema object instead of undefined-shaped data.
    properties: {},
  },
  Scene: {
    properties: {
      location:    { type: 'string', title: 'Location' },
      participants:{ type: 'array',  items: { type: 'string' }, title: 'Participants' },
      status:      { type: 'string', enum: ['planned', 'played', 'skipped', ''], title: 'Status' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
  Rule: {
    properties: {
      source:      { type: 'string', title: 'Source (e.g. PHB p. 42)' },
      category:    { type: 'string', title: 'Category' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
    },
  },
  Resource: {
    properties: {
      type:        { type: 'string', title: 'Type' },
      quantity:    { type: 'number', title: 'Quantity' },
      unit:        { type: 'string', title: 'Unit' },
      location:    { type: 'string', title: 'Storage Location' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
    },
  },
  Culture: {
    properties: {
      region:      { type: 'string', title: 'Region' },
      language:    { type: 'string', title: 'Language' },
      religion:    { type: 'string', title: 'Religion' },
      government:  { type: 'string', enum: ['monarchy', 'republic', 'theocracy', 'tribal', 'anarchy', 'oligarchy', ''], title: 'Government' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
  // #271: standalone, undated world lore (story/backstory/secret/prophecy/
  // rumor/legend/history…) — distinct from Event, which requires a start_day.
  // lore_kind is a soft, DM-extensible string (D1) — never a DB enum, so no
  // `enum` here (LORE_KIND_SUGGESTIONS in lore-schema.ts are seed suggestions
  // for the picker UI, not a closed set).
  Lore: {
    properties: {
      lore_kind:   { type: 'string', title: 'Kind' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Secret (GM only)' },
    },
  },
};

export function getSchemaForType(type: string): EntityTypeSchema {
  return ENTITY_TYPE_SCHEMAS[type] ?? { properties: {} };
}
