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

export const ENTITY_TYPE_SCHEMAS: Record<string, EntityTypeSchema> = {
  Character: {
    properties: {
      status:      { type: 'string', enum: ['alive', 'dead', 'unknown', 'missing'], title: 'Status' },
      race:        { type: 'string', title: 'Rasse / Spezies' },
      class:       { type: 'string', title: 'Klasse / Beruf' },
      alignment:   { type: 'string', enum: ['LG','NG','CG','LN','TN','CN','LE','NE','CE',''], title: 'Gesinnung' },
      age:         { type: 'number', title: 'Alter' },
      affiliation: { type: 'string', title: 'Zugehörigkeit' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
  Location: {
    properties: {
      type:        { type: 'string', enum: ['city', 'village', 'dungeon', 'wilderness', 'building', 'plane', 'region', ''], title: 'Typ' },
      climate:     { type: 'string', title: 'Klima' },
      population:  { type: 'string', title: 'Bevölkerung' },
      ruler:       { type: 'string', title: 'Herrscher' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
  Faction: {
    properties: {
      type:        { type: 'string', enum: ['guild', 'religion', 'government', 'military', 'criminal', 'secret', ''], title: 'Typ' },
      alignment:   { type: 'string', enum: ['LG','NG','CG','LN','TN','CN','LE','NE','CE',''], title: 'Gesinnung' },
      size:        { type: 'string', enum: ['tiny', 'small', 'medium', 'large', 'massive', ''], title: 'Größe' },
      leader:      { type: 'string', title: 'Anführer' },
      headquarters:{ type: 'string', title: 'Hauptquartier' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
  Item: {
    properties: {
      type:        { type: 'string', enum: ['weapon', 'armor', 'tool', 'artifact', 'consumable', 'misc', ''], title: 'Typ' },
      rarity:      { type: 'string', enum: ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', ''], title: 'Seltenheit' },
      value:       { type: 'string', title: 'Wert' },
      weight:      { type: 'number', title: 'Gewicht (kg)' },
      attunement:  { type: 'boolean', title: 'Bindung erforderlich' },
      owner:       { type: 'string', title: 'Besitzer' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
  Quest: {
    properties: {
      status:      { type: 'string', enum: ['active', 'completed', 'failed', 'on hold', ''], title: 'Status' },
      giver:       { type: 'string', title: 'Auftraggeber' },
      reward:      { type: 'string', title: 'Belohnung' },
      difficulty:  { type: 'string', enum: ['trivial', 'easy', 'medium', 'hard', 'deadly', ''], title: 'Schwierigkeit' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
  Event: {
    properties: {
      date:        { type: 'string', title: 'Datum (In-World)' },
      location:    { type: 'string', title: 'Ort' },
      importance:  { type: 'string', enum: ['minor', 'moderate', 'major', 'pivotal', ''], title: 'Bedeutung' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
  Scene: {
    properties: {
      location:    { type: 'string', title: 'Ort' },
      participants:{ type: 'array',  items: { type: 'string' }, title: 'Beteiligte' },
      status:      { type: 'string', enum: ['planned', 'played', 'skipped', ''], title: 'Status' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
  Rule: {
    properties: {
      source:      { type: 'string', title: 'Quelle (z.B. PHB S. 42)' },
      category:    { type: 'string', title: 'Kategorie' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
    },
  },
  Resource: {
    properties: {
      type:        { type: 'string', title: 'Typ' },
      quantity:    { type: 'number', title: 'Menge' },
      unit:        { type: 'string', title: 'Einheit' },
      location:    { type: 'string', title: 'Lagerort' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
    },
  },
  Culture: {
    properties: {
      region:      { type: 'string', title: 'Region' },
      language:    { type: 'string', title: 'Sprache' },
      religion:    { type: 'string', title: 'Religion' },
      government:  { type: 'string', enum: ['monarchy', 'republic', 'theocracy', 'tribal', 'anarchy', 'oligarchy', ''], title: 'Regierungsform' },
      tags:        { type: 'array',  items: { type: 'string' }, title: 'Tags' },
      secret:      { type: 'boolean', title: 'Geheim (nur GM)' },
    },
  },
};

export function getSchemaForType(type: string): EntityTypeSchema {
  return ENTITY_TYPE_SCHEMAS[type] ?? { properties: {} };
}
