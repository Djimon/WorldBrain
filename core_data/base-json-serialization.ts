type JsonObject = Record<string, unknown>;

type BaseEntity = {
  id: string;
  type: string;
  title: string;
  summary?: string;
  aliases?: string[];
  properties?: JsonObject;
  body?: {
    format: 'portable_blocks_v1';
    blocks: unknown[];
  };
  visibility?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type ProjectMetadata = {
  id: string;
  title: string;
  schema_version: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

const entityFieldOrder = [
  'id',
  'type',
  'title',
  'summary',
  'aliases',
  'properties',
  'body',
  'visibility',
  'created_at',
  'updated_at',
] as const;

const projectFieldOrder = ['id', 'title', 'schema_version', 'created_at', 'updated_at'] as const;

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, item]) => [key, sortJsonValue(item)]),
    );
  }

  return value;
}

const ENTITY_STRIP_FIELDS = new Set([
  'database_rowid', 'imported_at', 'search_rank', 'effective_title',
  'campaign_notes', 'campaign_overrides', 'session_progression',
]);

function pickOrderedFields<T extends JsonObject>(source: T, fieldOrder: readonly string[], stripFields?: Set<string>) {
  const ordered: JsonObject = {};

  for (const fieldName of fieldOrder) {
    if (source[fieldName] !== undefined) {
      ordered[fieldName] = sortJsonValue(source[fieldName]);
    }
  }

  const knownFields = new Set(fieldOrder);
  for (const key of Object.keys(source)) {
    if (!knownFields.has(key) && source[key] !== undefined && !stripFields?.has(key)) {
      ordered[key] = sortJsonValue(source[key]);
    }
  }

  return ordered;
}

function serializeBaseJson(value: JsonObject) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeBaseEntity(entity: BaseEntity) {
  return serializeBaseJson(pickOrderedFields(entity, entityFieldOrder, ENTITY_STRIP_FIELDS));
}

export function serializeProjectMetadata(project: ProjectMetadata) {
  return serializeBaseJson(pickOrderedFields(project, projectFieldOrder));
}

export function createBaseEntityFilename(entity: Pick<BaseEntity, 'id' | 'type'>) {
  return `entities/${entity.type}/${entity.id}.json`;
}
