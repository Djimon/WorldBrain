import type { DatabaseLike } from '../src/services/entity-service';

type ReadEffectiveEntityInput = {
  database: DatabaseLike;
  entityId: string;
};

type BaseEntity = {
  id: string;
  type: string;
  title: string;
  summary: string;
  aliases: string[];
  properties: Record<string, unknown>;
  body: {
    format: 'portable_blocks_v1';
    blocks: unknown[];
  };
  visibility: string;
  created_at: string;
  updated_at: string;
};

type MissingEntityResult = {
  found: false;
  entityId: string;
  reason: 'base_entity_missing';
  orphanedOverrideCount: number;
};

type FoundEntityResult = {
  found: true;
  entityId: string;
  entity: BaseEntity;
  baseEntity: BaseEntity;
  overriddenFields: string[];
  orphanedOverrideCount: number;
};

type EffectiveEntityResult = FoundEntityResult | MissingEntityResult;

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  return JSON.parse(value) as T;
}

function rowToBaseEntity(row: Record<string, unknown>): BaseEntity {
  return {
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    summary: String(row.summary),
    aliases: parseJsonField<string[]>(row.aliases_json, []),
    properties: parseJsonField<Record<string, unknown>>(row.properties_json, {}),
    body: parseJsonField<BaseEntity['body']>(row.body_json, { format: 'portable_blocks_v1', blocks: [] }),
    visibility: String(row.visibility),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function diffEntityFields(base: BaseEntity, effective: BaseEntity): string[] {
  const fields: string[] = [];
  if (effective.title !== base.title) fields.push('title');
  if (effective.summary !== base.summary) fields.push('summary');
  if (effective.visibility !== base.visibility) fields.push('visibility');
  if (JSON.stringify(effective.aliases) !== JSON.stringify(base.aliases)) fields.push('aliases');
  const allPropertyKeys = new Set([...Object.keys(base.properties), ...Object.keys(effective.properties)]);
  for (const key of allPropertyKeys) {
    if (JSON.stringify(effective.properties[key]) !== JSON.stringify(base.properties[key])) {
      fields.push(`properties.${key}`);
    }
  }
  return fields.sort((l, r) => l.localeCompare(r));
}

function applyPatch(entity: BaseEntity, patch: Record<string, unknown>): BaseEntity {
  const next: BaseEntity = {
    ...entity,
    aliases: [...entity.aliases],
    properties: { ...entity.properties },
    body: { ...entity.body, blocks: [...entity.body.blocks] },
  };
  if (typeof patch.title === 'string') next.title = patch.title;
  if (typeof patch.summary === 'string') next.summary = patch.summary;
  if (Array.isArray(patch.aliases) && patch.aliases.every((a) => typeof a === 'string')) next.aliases = [...patch.aliases];
  if (typeof patch.visibility === 'string') next.visibility = patch.visibility;
  if (patch.properties !== null && typeof patch.properties === 'object' && !Array.isArray(patch.properties)) {
    next.properties = { ...next.properties, ...(patch.properties as Record<string, unknown>) };
  }
  return next;
}

export async function readEffectiveEntity({ database, entityId }: ReadEffectiveEntityInput): Promise<EffectiveEntityResult> {
  const baseRows = await database.select<Record<string, unknown>>(
    'SELECT * FROM base_entities WHERE id = ?',
    [entityId],
  );
  const overrideRows = await database.select<Record<string, unknown>>(
    'SELECT patch_json FROM campaign_entity_overrides WHERE entity_id = ? ORDER BY id',
    [entityId],
  ).catch(() => [] as Record<string, unknown>[]);

  if (baseRows.length === 0) {
    return { found: false, entityId, reason: 'base_entity_missing', orphanedOverrideCount: overrideRows.length };
  }

  const baseEntity = rowToBaseEntity(baseRows[0]);
  let entity = baseEntity;
  for (const row of overrideRows) {
    entity = applyPatch(entity, parseJsonField<Record<string, unknown>>(row.patch_json, {}));
  }

  return {
    found: true,
    entityId,
    entity,
    baseEntity,
    overriddenFields: diffEntityFields(baseEntity, entity),
    orphanedOverrideCount: 0,
  };
}
