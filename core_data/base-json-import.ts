import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateBaseJsonLoad } from './base-json-validation';

type DatabaseStatement = {
  run: (...values: unknown[]) => unknown;
};

type RuntimeDatabase = {
  exec: (source: string) => unknown;
  prepare: (source: string) => DatabaseStatement;
};

type ImportBaseJsonProjectInput = {
  database: RuntimeDatabase;
  projectRoot: string;
};

type BaseJsonDocument = {
  path: string;
  data: unknown;
};

type ParseErrorDocument = {
  path: string;
  parseError: string;
};

type MaybeDocument = BaseJsonDocument | ParseErrorDocument;

function isParseError(doc: MaybeDocument): doc is ParseErrorDocument {
  return 'parseError' in doc;
}

function readJsonDocument(projectRoot: string, relativePath: string): MaybeDocument {
  try {
    return {
      path: relativePath,
      data: JSON.parse(readFileSync(join(projectRoot, relativePath), 'utf8')),
    };
  } catch (error) {
    return {
      path: relativePath,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function listJsonFiles(directory: string, projectRoot: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const absolutePath = join(directory, entry.name);

        if (entry.isDirectory()) {
          return listJsonFiles(absolutePath, projectRoot);
        }

        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          return [];
        }

        return relative(projectRoot, absolutePath).replaceAll('\\', '/');
      })
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    return [];
  }
}

function readJsonDocuments(projectRoot: string, rootPath: string): MaybeDocument[] {
  return listJsonFiles(join(projectRoot, rootPath), projectRoot).map((relativePath) =>
    readJsonDocument(projectRoot, relativePath),
  );
}

function assertProjectRoot(projectRoot: string) {
  const stats = statSync(projectRoot);

  if (!stats.isDirectory()) {
    throw new Error(`Project root is not a directory: ${projectRoot}`);
  }
}

function insertEntityType(database: RuntimeDatabase, entityType: Record<string, unknown>) {
  database
    .prepare(
      [
        'INSERT INTO base_entity_types',
        '(id, name, title, schema_version, schema_json, created_at, updated_at)',
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
      ].join(' '),
    )
    .run(
      entityType.id,
      entityType.name,
      entityType.title,
      entityType.schema_version,
      JSON.stringify(entityType.properties ?? {}),
      entityType.created_at,
      entityType.updated_at,
    );
}

function insertEntity(database: RuntimeDatabase, entity: Record<string, unknown>) {
  database
    .prepare(
      [
        'INSERT INTO base_entities',
        '(id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at)',
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ].join(' '),
    )
    .run(
      entity.id,
      entity.type,
      entity.title,
      entity.summary ?? '',
      JSON.stringify(entity.aliases ?? []),
      JSON.stringify(entity.properties ?? {}),
      JSON.stringify(entity.body ?? { format: 'portable_blocks_v1', blocks: [] }),
      entity.visibility ?? 'public',
      entity.created_at ?? '',
      entity.updated_at ?? '',
    );
}

type ParseStructuredError = {
  path: string;
  documentKind: 'base_entity' | 'entity_type' | 'project';
  severity: 'error';
  message: string;
};

function parseErrorToStructured(
  doc: ParseErrorDocument,
  documentKind: ParseStructuredError['documentKind'],
): ParseStructuredError {
  return {
    path: doc.path,
    documentKind,
    severity: 'error',
    message: `JSON parse error: ${doc.parseError}`,
  };
}

export function importBaseJsonProject({ database, projectRoot }: ImportBaseJsonProjectInput) {
  assertProjectRoot(projectRoot);

  const projectDoc = readJsonDocument(projectRoot, 'project.json');

  if (isParseError(projectDoc)) {
    return {
      blocked: true,
      imported: { entityTypes: 0, entities: 0 },
      errors: [parseErrorToStructured(projectDoc, 'project')],
    };
  }

  const parseErrors: ParseStructuredError[] = [];
  const validEntityTypeDocs: BaseJsonDocument[] = [];
  const validEntityDocs: BaseJsonDocument[] = [];

  for (const doc of readJsonDocuments(projectRoot, 'entity-types')) {
    if (isParseError(doc)) {
      parseErrors.push(parseErrorToStructured(doc, 'entity_type'));
    } else {
      validEntityTypeDocs.push(doc);
    }
  }

  for (const doc of readJsonDocuments(projectRoot, 'entities')) {
    if (isParseError(doc)) {
      parseErrors.push(parseErrorToStructured(doc, 'base_entity'));
    } else {
      validEntityDocs.push(doc);
    }
  }

  const validation = validateBaseJsonLoad({
    project: projectDoc,
    entityTypes: validEntityTypeDocs,
    entities: validEntityDocs,
  });

  if (validation.blocked) {
    return {
      blocked: true,
      imported: {
        entityTypes: 0,
        entities: 0,
      },
      errors: [...parseErrors, ...validation.errors],
    };
  }

  database.exec('BEGIN');

  try {
    database.exec('DELETE FROM base_entities');
    database.exec('DELETE FROM base_entity_types');

    for (const entityType of validation.acceptedEntityTypes) {
      insertEntityType(database, entityType as unknown as Record<string, unknown>);
    }

    for (const entity of validation.acceptedEntities) {
      insertEntity(database, entity as unknown as Record<string, unknown>);
    }

    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    blocked: false,
    imported: {
      entityTypes: validation.acceptedEntityTypes.length,
      entities: validation.acceptedEntities.length,
    },
    errors: [...parseErrors, ...validation.errors],
  };
}
