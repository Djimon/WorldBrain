import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { test } from 'node:test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(repoRoot, 'package.json');
const packageLockPath = join(repoRoot, 'package-lock.json');
const srcRoot = join(repoRoot, 'src');

const requiredRuntimeDependencies = Object.freeze(['react', 'react-dom']);
const requiredDevDependencies = Object.freeze(['typescript', 'vite']);
const allowedReactPluginDependencies = Object.freeze(['@vitejs/plugin-react', '@vitejs/plugin-react-swc']);
const forbiddenPackageManagerFiles = Object.freeze([
  'bun.lock',
  'bun.lockb',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
  '.yarnrc',
  '.yarnrc.yml',
]);
const forbiddenGeneratedDemoMarkers = Object.freeze([
  'Vite + React',
  'Click on the Vite and React logos',
  'count is',
  'reactLogo',
  'viteLogo',
]);
const forbiddenFeatureDomainMarkers = Object.freeze([
  'character',
  'entity',
  'faction',
  'item',
  'location',
  'map',
  'quest',
  'relation',
  'rule',
  'session',
]);

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readPackageJsonIfPresent() {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return readJsonFile(packageJsonPath);
}

function listFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(absolutePath);
    }

    return entry.isFile() ? [absolutePath] : [];
  });
}

function readTextFileIfPresent(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function listExistingForbiddenPackageManagerFiles() {
  return forbiddenPackageManagerFiles
    .map((filePath) => join(repoRoot, filePath))
    .filter((filePath) => existsSync(filePath))
    .filter((filePath) => statSync(filePath).isFile())
    .map((filePath) => relative(repoRoot, filePath));
}

function collectDependencyEntries(packageJson) {
  return [
    ...Object.entries(packageJson?.dependencies ?? {}),
    ...Object.entries(packageJson?.devDependencies ?? {}),
    ...Object.entries(packageJson?.optionalDependencies ?? {}),
  ];
}

function assertScriptContains(packageJson, scriptName, pattern) {
  const script = packageJson?.scripts?.[scriptName];

  assert.equal(typeof script, 'string', `Expected package.json script "${scriptName}" to exist`);
  assert.match(script, pattern);
}

function readRendererSourceText() {
  return listFiles(srcRoot)
    .filter((filePath) => ['.css', '.ts', '.tsx'].includes(extname(filePath)))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
}

const packageJson = readPackageJsonIfPresent();

test('M0-S03 declares a Vite React TypeScript renderer dependency baseline', () => {
  for (const dependencyName of requiredRuntimeDependencies) {
    assert.ok(
      packageJson?.dependencies?.[dependencyName],
      `Expected runtime dependency "${dependencyName}" in package.json`,
    );
  }

  for (const dependencyName of requiredDevDependencies) {
    assert.ok(
      packageJson?.devDependencies?.[dependencyName],
      `Expected dev dependency "${dependencyName}" in package.json`,
    );
  }

  assert.ok(
    allowedReactPluginDependencies.some((dependencyName) => packageJson?.devDependencies?.[dependencyName]),
    'Expected a Vite React plugin dev dependency in package.json',
  );
});

test('M0-S03 commits npm lockfile metadata for the renderer scaffold', () => {
  assert.match(packageJson?.packageManager ?? '', /^npm@/u);
  assert.ok(existsSync(packageLockPath), 'Expected package-lock.json at the repository root');

  const packageLock = readJsonFile(packageLockPath);

  assert.equal(packageLock.lockfileVersion, 3);
  assert.equal(packageLock.packages?.['']?.name, packageJson?.name);
  assert.ok(packageLock.packages?.['']?.dependencies?.react, 'Expected React to be locked at the root package');
});

test('M0-S03 saves scaffold dependencies as exact versions', () => {
  const dependencyEntries = collectDependencyEntries(packageJson);

  assert.ok(dependencyEntries.length > 0, 'Expected renderer scaffold dependencies in package.json');

  for (const [dependencyName, versionSpec] of dependencyEntries) {
    assert.match(
      versionSpec,
      /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u,
      `Expected "${dependencyName}" to use an exact semver version, got "${versionSpec}"`,
    );
  }
});

test('M0-S03 provides renderer entry files for React and TypeScript', () => {
  const mainTsxPath = join(srcRoot, 'main.tsx');
  const appTsxPath = join(srcRoot, 'App.tsx');

  assert.ok(existsSync(join(repoRoot, 'index.html')), 'Expected Vite index.html at the repository root');
  assert.ok(existsSync(join(repoRoot, 'tsconfig.json')), 'Expected TypeScript config at the repository root');
  assert.ok(existsSync(mainTsxPath), 'Expected src/main.tsx as the renderer entrypoint');
  assert.ok(existsSync(appTsxPath), 'Expected src/App.tsx as the shell placeholder component');

  const mainTsx = readTextFileIfPresent(mainTsxPath);

  assert.match(mainTsx, /react-dom\/client/u);
  assert.match(mainTsx, /<App\s*\/>/u);
});

test('M0-S03 exposes renderer development, build, preview, and test commands', () => {
  assertScriptContains(packageJson, 'dev', /(?:^|\s)vite(?:\s|$)/u);
  assertScriptContains(packageJson, 'build', /(?:^|\s)(?:tsc|vite\s+build)(?:\s|$)/u);
  assertScriptContains(packageJson, 'preview', /(?:^|\s)vite\s+preview(?:\s|$)/u);
  assertScriptContains(packageJson, 'test', /(?:^|\s)node(?:\.exe)?\s+--test(?:\s|$)/u);
});

test('M0-S03 trims generated Vite demo content from the renderer scaffold', () => {
  const rendererSourceText = readRendererSourceText();

  for (const marker of forbiddenGeneratedDemoMarkers) {
    assert.ok(
      !rendererSourceText.includes(marker),
      `Expected generated Vite demo marker "${marker}" to be removed`,
    );
  }

  assert.ok(!existsSync(join(srcRoot, 'assets', 'react.svg')), 'Expected default React logo asset to be removed');
  assert.ok(!existsSync(join(repoRoot, 'public', 'vite.svg')), 'Expected default Vite logo asset to be removed');
});

test('M0-S03 keeps the renderer scaffold free of feature-domain implementation code', () => {
  const rendererSourceText = readRendererSourceText().toLowerCase();

  for (const marker of forbiddenFeatureDomainMarkers) {
    assert.ok(
      !rendererSourceText.includes(marker),
      `Expected renderer scaffold to avoid feature-domain marker "${marker}"`,
    );
  }

  assert.deepEqual(listExistingForbiddenPackageManagerFiles(), []);
});
