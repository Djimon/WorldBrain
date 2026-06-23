import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(repoRoot, 'package.json');

function readTextFileIfPresent(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
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

function readPackageJsonIfPresent() {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return readJsonFile(packageJsonPath);
}

function readRepositoryCheckSurface(packageJson) {
  const scripts = packageJson?.scripts ?? {};
  const checkCommands = Object.entries(scripts)
    .filter(([name]) => /^check:(?:toolchain|prereq|prereqs|prerequisites)$/u.test(name))
    .map(([, command]) => command);

  const scriptFiles = checkCommands
    .flatMap((command) => [...command.matchAll(/\bscripts\/[^\s'"]+\.mjs\b/gu)])
    .map(([scriptPath]) => join(repoRoot, scriptPath.replaceAll('/', '\\')));

  return [
    ...checkCommands,
    ...scriptFiles.map((scriptPath) => readTextFileIfPresent(scriptPath)),
  ].join('\n');
}

function readImplementationPathSurface(packageJson) {
  const topLevelDocs = [
    readTextFileIfPresent(join(repoRoot, 'README.md')),
    readTextFileIfPresent(join(repoRoot, 'CONTRIBUTING.md')),
  ].join('\n');

  return JSON.stringify({
    packageManager: packageJson?.packageManager,
    scripts: packageJson?.scripts,
    dependencies: packageJson?.dependencies,
    devDependencies: packageJson?.devDependencies,
    topLevelDocs,
  });
}

function assertPattern(input, pattern, message) {
  assert.ok(pattern.test(input), message);
}

const packageJson = readPackageJsonIfPresent();
const projectDocumentation = readProjectDocumentation();
const checkSurface = readRepositoryCheckSurface(packageJson);
const implementationPathSurface = readImplementationPathSurface(packageJson);

test('M0-S09 documents Node and npm version policy or discovery metadata', () => {
  const nodeVersionFileExists = ['.node-version', '.nvmrc'].some((fileName) => existsSync(join(repoRoot, fileName)));

  assert.ok(nodeVersionFileExists, 'Expected .node-version or .nvmrc at the repository root');
  assert.match(packageJson?.packageManager ?? '', /^npm@\d+\.\d+\.\d+$/u);
  assertPattern(projectDocumentation, /node(?:\.js)?/iu, 'Expected project documentation to mention Node.js');
  assertPattern(projectDocumentation, /npm/iu, 'Expected project documentation to mention npm');
});

test('M0-S09 documents Rust as a Tauri development prerequisite', () => {
  assertPattern(projectDocumentation, /rust/iu, 'Expected project documentation to mention Rust');
  assertPattern(projectDocumentation, /(?:rustc|cargo)/iu, 'Expected project documentation to mention rustc or cargo');
});

test('M0-S09 documents Windows C++ Build Tools and WebView2 prerequisites', () => {
  assertPattern(
    projectDocumentation,
    /(?:Microsoft\s+C\+\+\s+Build\s+Tools|MSVC|Visual\s+Studio\s+Build\s+Tools)/iu,
    'Expected project documentation to mention Microsoft C++ Build Tools, MSVC, or Visual Studio Build Tools',
  );
  assertPattern(projectDocumentation, /WebView2/iu, 'Expected project documentation to mention WebView2');
});

test('M0-S09 keeps npm documented as the M0 package manager', () => {
  assertPattern(
    projectDocumentation,
    /npm\s+(?:as|is|remains|the).{0,80}package manager/isu,
    'Expected project documentation to identify npm as the M0 package manager',
  );
  assert.match(packageJson?.packageManager ?? '', /^npm@/u);
});

test('M0-S09 exposes a prerequisite check surface for Node, npm, Rust, and Tauri', () => {
  const documentedCheckSequence = [
    /node\s+--version/iu,
    /npm\s+--version/iu,
    /(?:rustc|cargo)\s+--version/iu,
    /tauri\s+--version/iu,
  ].every((pattern) => pattern.test(projectDocumentation));

  const repositoryCheckCoversPrereqs = [
    /node/iu,
    /npm/iu,
    /(?:rustc|cargo|rust)/iu,
    /tauri/iu,
  ].every((pattern) => pattern.test(checkSurface));

  assert.ok(
    documentedCheckSequence || repositoryCheckCoversPrereqs,
    'Expected either a documented check sequence or a repository check script covering Node, npm, Rust, and Tauri',
  );
});

test('M0-S09 makes missing prerequisite handling explicit', () => {
  const missingHandlingSurface = `${projectDocumentation}\n${checkSurface}`;

  assertPattern(
    missingHandlingSurface,
    /(?:missing|required command is not available|not available|install)/iu,
    'Expected docs or check script to explain missing prerequisite handling',
  );
  assertPattern(
    missingHandlingSurface,
    /(?:rust|cargo|rustc)/iu,
    'Expected missing prerequisite guidance to cover Rust',
  );
  assertPattern(missingHandlingSurface, /tauri/iu, 'Expected missing prerequisite guidance to cover Tauri');
});

test('M0-S09 does not put pywebview on the M0 implementation path', () => {
  const lowerSurface = implementationPathSurface.toLowerCase();

  if (lowerSurface.includes('pywebview')) {
    assert.match(lowerSurface, /(?:pywebview\s+is\s+not\s+used|not\s+use\s+pywebview|pywebview\s+.*not\s+.*m0)/u);
  }
});
