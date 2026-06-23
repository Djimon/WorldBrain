import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcRoot = join(repoRoot, 'src');
const packageJsonPath = join(repoRoot, 'package.json');

const semanticTokens = Object.freeze([
  '--color-text',
  '--color-text-muted',
  '--color-accent',
  '--color-accent-strong',
  '--color-surface',
  '--color-surface-alt',
  '--color-background',
  '--color-border',
  '--color-status-success',
  '--color-status-warning',
  '--color-status-failure',
  '--color-status-muted',
]);

const forbiddenComponentSystems = Object.freeze([
  '@chakra-ui',
  '@headlessui',
  '@mui',
  '@radix-ui',
  'antd',
  'bootstrap',
  'daisyui',
  'flowbite',
  'mantine',
  'semantic-ui',
]);

const forbiddenMarketingMarkers = Object.freeze([
  'hero',
  'landing',
  'feature-card',
  'pricing',
  'testimonial',
  'radial-gradient',
  'linear-gradient',
]);

const allowedRawColorFiles = new Set([
  'src/styles/tokens.css',
  'src/styles/theme.css',
  'src/style.css',
]);

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

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readCssSurface() {
  return listFiles(srcRoot)
    .filter((filePath) => extname(filePath) === '.css')
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
}

function readSourceSurface() {
  return listFiles(srcRoot)
    .filter((filePath) => ['.css', '.ts', '.tsx'].includes(extname(filePath)))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
}

function extractBlock(text, selectorPattern) {
  const match = selectorPattern.exec(text);
  if (!match) {
    return '';
  }

  const openBraceIndex = text.indexOf('{', match.index);
  if (openBraceIndex === -1) {
    return '';
  }

  let depth = 0;
  for (let index = openBraceIndex; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1;
    }

    if (text[index] === '}') {
      depth -= 1;
    }

    if (depth === 0) {
      return text.slice(openBraceIndex + 1, index);
    }
  }

  return '';
}

function assertTokenBlockContains(block, tokenName, blockName) {
  assert.ok(new RegExp(`${tokenName}\\s*:`, 'u').test(block), `Expected ${blockName} to define ${tokenName}`);
}

function assertPattern(input, pattern, message) {
  assert.ok(pattern.test(input), message);
}

const packageJson = readJsonFile(packageJsonPath);
const cssSurface = readCssSurface();
const sourceSurface = readSourceSurface();

test('M0-S05 defines semantic CSS tokens for text, accent, surfaces, borders, and status colors', () => {
  for (const tokenName of semanticTokens) {
    assertPattern(cssSurface, new RegExp(`${tokenName}\\s*:`, 'u'), `Expected CSS token ${tokenName}`);
  }
});

test('M0-S05 defines light and dark themes through the same semantic token names', () => {
  const lightBlock = extractBlock(cssSurface, /:root\b/u);
  const darkBlock =
    extractBlock(cssSurface, /\[data-theme=['"]dark['"]\]/u) ||
    extractBlock(cssSurface, /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/u);

  assert.notEqual(lightBlock, '', 'Expected :root light theme token block');
  assert.notEqual(darkBlock, '', 'Expected dark theme token block or prefers-color-scheme dark block');

  for (const tokenName of semanticTokens) {
    assertTokenBlockContains(lightBlock, tokenName, ':root');
    assertTokenBlockContains(darkBlock, tokenName, 'dark theme');
  }
});

test('M0-S05 primitive styles use semantic tokens instead of scattered raw colors', () => {
  const colorLiteralPattern = /#[0-9a-fA-F]{3,8}|rgba?\(/gu;
  const rawColorViolations = listFiles(srcRoot)
    .filter((filePath) => ['.css', '.ts', '.tsx'].includes(extname(filePath)))
    .flatMap((filePath) => {
      const relativePath = relative(repoRoot, filePath).replaceAll('\\', '/');
      if (allowedRawColorFiles.has(relativePath)) {
        return [];
      }

      return [...readFileSync(filePath, 'utf8').matchAll(colorLiteralPattern)].map(([match]) => `${relativePath}: ${match}`);
    });

  assert.deepEqual(rawColorViolations, []);
  assertPattern(cssSurface, /var\(--color-/u, 'Expected CSS styles to consume semantic color tokens');
});

test('M0-S05 establishes dense tool-first sizing for reusable controls', () => {
  assertPattern(cssSurface, /--space-1\s*:/u, 'Expected compact spacing token --space-1');
  assertPattern(cssSurface, /--space-2\s*:/u, 'Expected compact spacing token --space-2');
  assertPattern(cssSurface, /--space-3\s*:/u, 'Expected compact spacing token --space-3');
  assertPattern(cssSurface, /--radius-sm\s*:/u, 'Expected radius token --radius-sm');
  assertPattern(cssSurface, /--radius-md\s*:/u, 'Expected radius token --radius-md');
  assertPattern(cssSurface, /min-height\s*:\s*36px/u, 'Expected compact 36px control minimum height');
  assert.ok(!/font-size\s*:\s*clamp\(/u.test(cssSurface), 'Expected compact UI text sizing instead of viewport-scaled hero text');
});

test('M0-S05 avoids marketing hero layout, decorative card landscape, and feature content', () => {
  const lowerSourceSurface = sourceSurface.toLowerCase();

  for (const marker of forbiddenMarketingMarkers) {
    assert.ok(!lowerSourceSurface.includes(marker), `Expected UI foundation to avoid "${marker}"`);
  }
});

test('M0-S05 does not introduce a third-party component system', () => {
  const dependencyNames = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
  }).map((dependencyName) => dependencyName.toLowerCase());

  for (const forbiddenDependency of forbiddenComponentSystems) {
    assert.ok(
      !dependencyNames.some((dependencyName) => dependencyName.startsWith(forbiddenDependency)),
      `Expected no dependency on third-party component system ${forbiddenDependency}`,
    );
  }
});
