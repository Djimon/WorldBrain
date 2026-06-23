import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const storageEpicPath = join(repoRoot, 'planning', 'epics', 'EPIC-002-json-ground-truth-runtime-database.md');
const schemaRoot = join(repoRoot, 'schemas', 'base');
const schemaPaths = Object.freeze({
  project: join(schemaRoot, 'project.schema.json'),
  entityType: join(schemaRoot, 'entity-type.schema.json'),
  entity: join(schemaRoot, 'entity.schema.json'),
});

const coreEntityTypes = Object.freeze([
  'Character',
  'Location',
  'Faction',
  'Item',
  'Event',
  'Quest',
  'Scene',
  'Rule',
  'Resource',
  'Culture',
]);

const entityFields = Object.freeze([
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
]);

function readTextFile(filePath) {
  assert.ok(existsSync(filePath), `Expected file to exist: ${filePath}`);

  return readFileSync(filePath, 'utf8');
}

function readJsonFile(filePath) {
  return JSON.parse(readTextFile(filePath));
}

function assertJsonSchema(schema, name) {
  assert.match(schema.$schema ?? '', /2020-12/u, `Expected ${name} to use JSON Schema Draft 2020-12`);
  assert.equal(schema.type, 'object', `Expected ${name} to validate JSON objects`);
  assert.equal(typeof schema.properties, 'object', `Expected ${name} to define object properties`);
  assert.ok(Array.isArray(schema.required), `Expected ${name} to define required fields`);
}

function getPropertySchema(schema, fieldName, schemaName) {
  const propertySchema = schema.properties?.[fieldName];
  assert.equal(typeof propertySchema, 'object', `Expected ${schemaName} to define property "${fieldName}"`);

  return propertySchema;
}

function validateObjectSubset(schema, value, path = '$') {
  const errors = [];

  if (schema.type === 'object') {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      errors.push(`${path} must be an object`);
      return errors;
    }

    for (const fieldName of schema.required ?? []) {
      if (value[fieldName] === undefined) {
        errors.push(`${path}.${fieldName} is required`);
      }
    }

    for (const [fieldName, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (value[fieldName] !== undefined) {
        errors.push(...validateObjectSubset(propertySchema, value[fieldName], `${path}.${fieldName}`));
      }
    }

    return errors;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      return [`${path} must be an array`];
    }

    return value.flatMap((item, index) => validateObjectSubset(schema.items ?? {}, item, `${path}[${index}]`));
  }

  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push(`${path} must be a string`);
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${path} must be a boolean`);
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of ${schema.enum.join(', ')}`);
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path} must equal ${schema.const}`);
  }

  return errors;
}

function assertValid(schema, value, message) {
  assert.deepEqual(validateObjectSubset(schema, value), [], message);
}

function assertInvalid(schema, value, expectedErrorPattern, message) {
  assert.match(validateObjectSubset(schema, value).join('\n'), expectedErrorPattern, message);
}

test('M1-S02 documents the base JSON project folder layout and core entity grouping', () => {
  const storageEpic = readTextFile(storageEpicPath);

  assert.match(storageEpic, /project\.json/u, 'Expected layout documentation to include project.json');
  assert.match(storageEpic, /entity[-_\s]?types?\/|\/entity[-_\s]?types?/iu, 'Expected layout documentation to include base entity type definitions');
  assert.match(storageEpic, /entities\/\{type\}|entities\/<type>|entities\/\[type\]|entities\/[a-z-]+\/\*\.json/iu, 'Expected layout documentation to group base entities by core entity type');

  for (const entityType of coreEntityTypes) {
    assert.match(storageEpic, new RegExp(`\\b${entityType}\\b`, 'u'), `Expected layout documentation to list core entity type ${entityType}`);
  }
});

test('M1-S02 stores project, entity-type, and base-entity schemas in a predictable base schema folder', () => {
  for (const [schemaName, schemaPath] of Object.entries(schemaPaths)) {
    assertJsonSchema(readJsonFile(schemaPath), schemaName);
  }
});

test('M1-S02 validates a minimal project metadata document with the selected JSON Schema approach', () => {
  const projectSchema = readJsonFile(schemaPaths.project);
  const validProject = {
    id: 'project-emberfall',
    title: 'Emberfall',
    schema_version: '1.0.0',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  };

  assertJsonSchema(projectSchema, 'project schema');
  assertValid(projectSchema, validProject, 'Expected sample project metadata to satisfy project.schema.json');
});

test('M1-S02 validates a minimal base entity and supports portable_blocks_v1 body storage', () => {
  const entitySchema = readJsonFile(schemaPaths.entity);
  const validEntity = {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist with a disputed inheritance.',
    aliases: ['The Red Notary'],
    properties: {
      role: 'archivist',
    },
    body: {
      format: 'portable_blocks_v1',
      blocks: [],
    },
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  };

  assertJsonSchema(entitySchema, 'entity schema');

  for (const fieldName of entityFields) {
    getPropertySchema(entitySchema, fieldName, 'entity schema');
  }

  assert.deepEqual(getPropertySchema(entitySchema, 'type', 'entity schema').enum, coreEntityTypes);
  assert.equal(getPropertySchema(getPropertySchema(entitySchema, 'body', 'entity schema'), 'format', 'entity body schema').const, 'portable_blocks_v1');
  assertValid(entitySchema, validEntity, 'Expected sample base entity to satisfy entity.schema.json');
});

test('M1-S02 rejects a base entity missing required identity fields', () => {
  const entitySchema = readJsonFile(schemaPaths.entity);
  const invalidEntity = {
    summary: 'Missing id, type, and title.',
    aliases: [],
    properties: {},
    body: {
      format: 'portable_blocks_v1',
      blocks: [],
    },
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  };

  assertInvalid(entitySchema, invalidEntity, /\$\.id is required[\s\S]*\$\.type is required[\s\S]*\$\.title is required/u, 'Expected missing entity identity fields to fail validation');
});
