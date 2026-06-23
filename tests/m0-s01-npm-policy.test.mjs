import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
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

function readPackageJson() {
  const packageJsonPath = join(repoRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

const npmConfig = readNpmConfig();
const projectDocumentation = readProjectDocumentation();

test('M0-S01 defines save-exact=true in repository npm config', () => {
  assert.equal(npmConfig.get('save-exact'), requiredNpmConfig['save-exact']);
});

test('M0-S01 defines package-lock=true in repository npm config', () => {
  assert.equal(npmConfig.get('package-lock'), requiredNpmConfig['package-lock']);
});

test('M0-S01 defines fund=false in repository npm config', () => {
  assert.equal(npmConfig.get('fund'), requiredNpmConfig.fund);
});

test('M0-S01 defines audit=true in repository npm config', () => {
  assert.equal(npmConfig.get('audit'), requiredNpmConfig.audit);
});

test('M0-S01 documents npm ci as the clean-install command', () => {
  assert.ok(
    projectDocumentation.includes('npm ci'),
    'Expected project documentation to include the exact clean-install command: npm ci',
  );
});

test('M0-S01 documents npm audit --audit-level=high as the security gate', () => {
  assert.ok(
    projectDocumentation.includes('npm audit --audit-level=high'),
    'Expected project documentation to include the exact security gate: npm audit --audit-level=high',
  );
});

test('M0-S01 introduces no package manager other than npm', () => {
  assert.deepEqual(listExistingForbiddenPackageManagerFiles(), []);

  const packageJson = readPackageJson();
  if (packageJson?.packageManager !== undefined) {
    assert.match(packageJson.packageManager, /^npm@/u);
  }
});
