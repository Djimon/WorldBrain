import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(repoRoot, 'package.json');
const packageLockPath = join(repoRoot, 'package-lock.json');
const npmrcPath = join(repoRoot, '.npmrc');

const requiredNpmConfig = Object.freeze({
  'save-exact': 'true',
  'package-lock': 'true',
  fund: 'false',
  audit: 'true',
});

const forbiddenPackageManagerFiles = Object.freeze([
  'bun.lock',
  'bun.lockb',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
  '.yarnrc',
  '.yarnrc.yml',
]);

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readNpmConfig() {
  if (!existsSync(npmrcPath)) {
    return new Map();
  }

  const entries = readFileSync(npmrcPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith(';'))
    .map((line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        return [line, ''];
      }

      return [
        line.slice(0, separatorIndex).trim(),
        line.slice(separatorIndex + 1).trim(),
      ];
    });

  return new Map(entries);
}

function listMarkdownFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listMarkdownFiles(absolutePath);
    }

    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [absolutePath] : [];
  });
}

function readProjectDocumentation() {
  const documentationFiles = [
    join(repoRoot, 'README.md'),
    join(repoRoot, 'CONTRIBUTING.md'),
    ...listMarkdownFiles(join(repoRoot, 'docs')),
    ...listMarkdownFiles(join(repoRoot, 'planning')),
  ].filter((filePath) => existsSync(filePath));

  return documentationFiles
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
}

function listExistingForbiddenPackageManagerFiles() {
  return forbiddenPackageManagerFiles
    .map((filePath) => join(repoRoot, filePath))
    .filter((filePath) => existsSync(filePath))
    .filter((filePath) => statSync(filePath).isFile())
    .map((filePath) => relative(repoRoot, filePath));
}

function readPackageJsonIfPresent() {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return readJsonFile(packageJsonPath);
}

test('M0-S08 has a root package.json for the Node npm workspace', () => {
  assert.ok(existsSync(packageJsonPath), 'Expected package.json at the repository root');
});

test('M0-S08 has a root package-lock.json for reproducible npm ci installs', () => {
  assert.ok(existsSync(packageLockPath), 'Expected package-lock.json at the repository root');
});

test('M0-S08 package-lock.json locks the root package declared by package.json', () => {
  assert.ok(existsSync(packageJsonPath), 'Expected package.json before validating package-lock.json');
  assert.ok(existsSync(packageLockPath), 'Expected package-lock.json before validating lock metadata');

  const packageJson = readJsonFile(packageJsonPath);
  const packageLock = readJsonFile(packageLockPath);

  assert.equal(packageLock.lockfileVersion, 3);
  assert.equal(packageLock.packages?.['']?.name, packageJson.name);
  assert.equal(packageLock.packages?.['']?.version, packageJson.version);
});

test('M0-S08 exposes the npm config decisions required by M0-S01', () => {
  const npmConfig = readNpmConfig();

  assert.deepEqual(
    Object.fromEntries([...npmConfig].filter(([key]) => key in requiredNpmConfig)),
    requiredNpmConfig,
  );
});

test('M0-S08 wires npm test to the Node test runner baseline', () => {
  assert.ok(existsSync(packageJsonPath), 'Expected package.json before validating npm scripts');

  const packageJson = readJsonFile(packageJsonPath);

  assert.equal(typeof packageJson.scripts?.test, 'string');
  assert.match(packageJson.scripts.test, /(?:^|\s)node(?:\.exe)?\s+--test(?:\s|$)/u);
});

test('M0-S08 documents Node and npm availability for future agents', () => {
  const projectDocumentation = readProjectDocumentation();
  const versionFileExists = ['.nvmrc', '.node-version'].some((fileName) => existsSync(join(repoRoot, fileName)));

  assert.ok(
    versionFileExists || (/node/i.test(projectDocumentation) && /npm/i.test(projectDocumentation)),
    'Expected either .nvmrc/.node-version or documentation that mentions both Node and npm setup',
  );
});

test('M0-S08 introduces no alternate package manager lockfile', () => {
  assert.deepEqual(listExistingForbiddenPackageManagerFiles(), []);

  const packageJson = readPackageJsonIfPresent();
  if (packageJson?.packageManager !== undefined) {
    assert.match(packageJson.packageManager, /^npm@/u);
  }
});
