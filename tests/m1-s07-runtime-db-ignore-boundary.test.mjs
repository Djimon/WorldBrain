import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const storageDocPath = join(repoRoot, 'planning', 'epics', 'EPIC-002-json-ground-truth-runtime-database.md');
const gitignorePath = join(repoRoot, '.gitignore');

function readTextFile(filePath) {
  assert.ok(existsSync(filePath), `Expected file to exist: ${filePath}`);

  return readFileSync(filePath, 'utf8');
}

function readStorageDoc() {
  return readTextFile(storageDocPath);
}

function extractBacktickedPath(pattern, description) {
  const match = pattern.exec(readStorageDoc());

  assert.ok(match?.[1], `Expected documentation to define ${description} in backticks`);

  return match[1].replaceAll('\\', '/').replace(/\/+$/u, '');
}

function gitCheckIgnoreStatus(relativePath) {
  const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', '--', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.ok(
    result.status === 0 || result.status === 1,
    `git check-ignore failed for ${relativePath}: ${result.stderr}`,
  );

  return result.status === 0;
}

function assertTracked(relativePath) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `Expected ${relativePath} to remain tracked`);
}

test('M1-S07 documents runtime SQLite/cache placement separately from base JSON content', () => {
  const storageDoc = readStorageDoc();
  const runtimePath = extractBacktickedPath(
    /runtime\s+SQLite(?:\/cache)?\s+(?:files|artifacts)\s+live\s+under\s+`([^`]+)`/iu,
    'where runtime SQLite/cache files live',
  );
  const baseJsonPath = extractBacktickedPath(
    /base\s+JSON\s+content\s+(?:lives|is stored)\s+under\s+`([^`]+)`/iu,
    'where base JSON content lives',
  );

  assert.notEqual(runtimePath, baseJsonPath, 'Expected runtime SQLite/cache path to be separate from base JSON content path');
  assert.match(storageDoc, /`base_\*`\s+tables.{0,120}rebuildable.{0,80}JSON/isu);
  assert.match(storageDoc, /`campaign_\*`.{0,160}(?:backup|export).{0,120}(?:later|explicit|strategy)/isu);
});

test('M1-S07 gitignore excludes generated runtime SQLite and cache artifacts', () => {
  readTextFile(gitignorePath);
  const runtimePath = extractBacktickedPath(
    /runtime\s+SQLite(?:\/cache)?\s+(?:files|artifacts)\s+live\s+under\s+`([^`]+)`/iu,
    'where runtime SQLite/cache files live',
  );

  for (const relativePath of [
    `${runtimePath}/worldbuilderx.sqlite`,
    `${runtimePath}/worldbuilderx.sqlite-wal`,
    `${runtimePath}/worldbuilderx.sqlite-shm`,
    `${runtimePath}/cache/query-cache.db`,
    `${runtimePath}/cache/query-cache.db-wal`,
    `${runtimePath}/cache/query-cache.db-shm`,
  ]) {
    assert.equal(gitCheckIgnoreStatus(relativePath), true, `Expected ${relativePath} to be ignored`);
  }
});

test('M1-S07 gitignore does not exclude base JSON project files or schema files', () => {
  for (const relativePath of [
    'project.json',
    'entity-types/character.json',
    'entities/Character/character-ada.json',
    'schemas/base/project.schema.json',
    'schemas/base/entity-type.schema.json',
    'schemas/base/entity.schema.json',
  ]) {
    assert.equal(gitCheckIgnoreStatus(relativePath), false, `Expected ${relativePath} not to be ignored`);
  }
});

test('M1-S07 keeps existing M0 toolchain files tracked', () => {
  for (const relativePath of [
    'package.json',
    'package-lock.json',
    '.npmrc',
    'src-tauri/Cargo.toml',
    'src-tauri/Cargo.lock',
    'src-tauri/tauri.conf.json',
  ]) {
    assertTracked(relativePath);
  }
});
