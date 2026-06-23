import entitySchema from '../schemas/base/entity.schema.json';
import entityTypeSchema from '../schemas/base/entity-type.schema.json';
import projectSchema from '../schemas/base/project.schema.json';

type JsonSchema = {
  type?: 'array' | 'boolean' | 'object' | 'string';
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: false;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
};

type BaseJsonDocument = {
  path: string;
  data: unknown;
};

type BaseJsonValidationInput = {
  project: BaseJsonDocument;
  entityTypes: BaseJsonDocument[];
  entities: BaseJsonDocument[];
};

type ValidationError = {
  path: string;
  documentKind: 'base_entity' | 'entity_type' | 'project';
  severity: 'blocking' | 'error';
  message: string;
};

type BaseProject = {
  id: string;
  title: string;
  schema_version: string;
  created_at: string;
  updated_at: string;
};

type BaseEntityType = {
  id: string;
  name: string;
  title: string;
  schema_version: string;
  properties?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type BaseEntity = {
  id: string;
  type: string;
  title: string;
  summary?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  body?: {
    format: 'portable_blocks_v1';
    blocks: unknown[];
  };
  visibility?: string;
  created_at?: string;
  updated_at?: string;
};

export type BaseJsonValidationResult = {
  blocked: boolean;
  errors: ValidationError[];
  acceptedProject?: BaseProject;
  acceptedEntityTypes: BaseEntityType[];
  acceptedEntities: BaseEntity[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateBySchema(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const errors: string[] = [];

  if (schema.type === 'object') {
    if (!isObject(value)) {
      return [`${path} must be an object`];
    }

    for (const fieldName of schema.required ?? []) {
      if (value[fieldName] === undefined) {
        errors.push(`${path}.${fieldName} is required`);
      }
    }

    if (schema.additionalProperties === false && schema.properties !== undefined) {
      const knownKeys = new Set(Object.keys(schema.properties));

      for (const key of Object.keys(value)) {
        if (!knownKeys.has(key)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }

    for (const [fieldName, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (value[fieldName] !== undefined) {
        errors.push(...validateBySchema(propertySchema, value[fieldName], `${path}.${fieldName}`));
      }
    }

    return errors;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      return [`${path} must be an array`];
    }

    return value.flatMap((item, index) => validateBySchema(schema.items ?? {}, item, `${path}[${index}]`));
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

function errorFor(
  document: BaseJsonDocument,
  documentKind: ValidationError['documentKind'],
  severity: ValidationError['severity'],
  messages: string[],
): ValidationError {
  return {
    path: document.path,
    documentKind,
    severity,
    message: messages.join('; '),
  };
}

export function validateBaseJsonLoad(input: BaseJsonValidationInput): BaseJsonValidationResult {
  const errors: ValidationError[] = [];
  const projectErrors = validateBySchema(projectSchema as JsonSchema, input.project.data);

  if (projectErrors.length > 0) {
    return {
      blocked: true,
      errors: [errorFor(input.project, 'project', 'blocking', projectErrors)],
      acceptedEntityTypes: [],
      acceptedEntities: [],
    };
  }

  const acceptedEntityTypes: BaseEntityType[] = [];
  const acceptedTypeNames = new Set<string>();

  for (const document of input.entityTypes) {
    const entityTypeErrors = validateBySchema(entityTypeSchema as JsonSchema, document.data);

    if (entityTypeErrors.length > 0) {
      errors.push(errorFor(document, 'entity_type', 'error', entityTypeErrors));
      continue;
    }

    const entityType = document.data as BaseEntityType;
    acceptedEntityTypes.push(entityType);
    acceptedTypeNames.add(entityType.name);
  }

  const acceptedEntities: BaseEntity[] = [];

  for (const document of input.entities) {
    const entityErrors = validateBySchema(entitySchema as JsonSchema, document.data);

    if (entityErrors.length > 0) {
      errors.push(errorFor(document, 'base_entity', 'error', entityErrors));
      continue;
    }

    const entity = document.data as BaseEntity;

    if (!acceptedTypeNames.has(entity.type)) {
      errors.push(errorFor(document, 'base_entity', 'error', [`entity type ${entity.type} is not valid for import`]));
      continue;
    }

    acceptedEntities.push(entity);
  }

  return {
    blocked: false,
    errors,
    acceptedProject: input.project.data as BaseProject,
    acceptedEntityTypes,
    acceptedEntities,
  };
}
