import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(repoRoot, 'package.json');

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
  ].filter((filePath) => existsSync(filePath));

  return documentationFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');
}

function assertDocumentedCommand(command) {
  assert.ok(projectDocumentation.includes(command), `Expected documentation to include command: ${command}`);
}

function assertPackageScript(scriptName) {
  assert.equal(typeof packageJson.scripts?.[scriptName], 'string', `Expected package script "${scriptName}"`);
}

function assertPattern(input, pattern, message) {
  assert.ok(pattern.test(input), message);
}

function scriptIsDocumented(scriptName) {
  return projectDocumentation.includes(`npm run ${scriptName}`);
}

const packageJson = readJsonFile(packageJsonPath);
const projectDocumentation = readProjectDocumentation();

test('M0-S07 documents required local setup steps and npm-only package policy', () => {
  assert.match(projectDocumentation, /Node\.js\s+`?\d+\.\d+\.\d+`?/u);
  assert.match(projectDocumentation, /npm\s+`?\d+\.\d+\.\d+`?/u);
  assert.match(projectDocumentation, /npm\s+(?:as|is|remains|the).{0,80}package manager/isu);
  assert.ok(!/pnpm|yarn|bun/iu.test(projectDocumentation), 'Expected no alternate package-manager instructions');
  assertDocumentedCommand('npm run check:toolchain');
  assertDocumentedCommand('npm run check:prerequisites');
});

test('M0-S07 documents clean install and security gate commands exactly', () => {
  assertDocumentedCommand('npm ci');
  assertDocumentedCommand('npm audit --audit-level=high');
});

test('M0-S07 documentation covers every existing verification package script', () => {
  for (const scriptName of Object.keys(packageJson.scripts ?? {})) {
    if (/^(?:check|check:.+|test|build|typecheck|lint|desktop:.+)$/u.test(scriptName)) {
      assert.ok(scriptIsDocumented(scriptName), `Expected documentation for package script: npm run ${scriptName}`);
    }
  }
});

test('M0-S07 exposes a typecheck and lint verification contract', () => {
  const hasTypecheckScript = typeof packageJson.scripts?.typecheck === 'string';
  const documentsBuildAsTypecheck = /typecheck.{0,120}npm run build|npm run build.{0,120}typecheck/isu.test(projectDocumentation);

  assert.ok(hasTypecheckScript || documentsBuildAsTypecheck, 'Expected typecheck script or explicit build-as-typecheck documentation');

  const hasLintScript = typeof packageJson.scripts?.lint === 'string';
  const documentsLintUnavailable = /lint.{0,120}(?:not configured|not yet configured|not available|none)/isu.test(projectDocumentation);

  assert.ok(hasLintScript || documentsLintUnavailable, 'Expected lint script or explicit lint-not-configured documentation');
});

test('M0-S07 provides an aggregate verification command or a documented equivalent sequence', () => {
  const aggregateScript = packageJson.scripts?.check;
  const hasAggregateCheck = typeof aggregateScript === 'string';

  if (hasAggregateCheck) {
    assertDocumentedCommand('npm run check');
    assert.match(aggregateScript, /npm\s+run\s+check:toolchain/u);
    assert.match(aggregateScript, /npm\s+run\s+check:prerequisites/u);
    assert.match(aggregateScript, /npm\s+run\s+test/u);
    assert.match(aggregateScript, /npm\s+run\s+build/u);
    return;
  }

  for (const command of [
    'npm run check:toolchain',
    'npm run check:prerequisites',
    'npm ci',
    'npm run test',
    'npm run build',
    'npm run desktop:build',
    'npm audit --audit-level=high',
  ]) {
    assertDocumentedCommand(command);
  }
});

test('M0-S07 documents the Story agent workflow and implementation test boundary', () => {
  for (const agentName of ['Requirement Agent', 'TDD Agent', 'Implementation Agent', 'Review Agent']) {
    assertPattern(projectDocumentation, new RegExp(agentName, 'u'), `Expected documentation for ${agentName}`);
  }

  assertPattern(
    projectDocumentation,
    /Implementation Agent.{0,160}(?:must not|must not edit|does not edit|do not edit).{0,80}(?:Story )?tests/isu,
    'Expected documentation to state that Implementation Agent sessions must not edit Story tests',
  );
});

test('M0-S07 package check contract remains executable by npm scripts', () => {
  assertPackageScript('test');
  assertPackageScript('build');
  assertPackageScript('check:toolchain');
  assertPackageScript('check:prerequisites');

  if (packageJson.scripts?.['desktop:build'] !== undefined) {
    assertPackageScript('desktop:build');
  }
});
