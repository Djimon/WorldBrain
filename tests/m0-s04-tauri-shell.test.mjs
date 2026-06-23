import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(repoRoot, 'package.json');
const tauriRoot = join(repoRoot, 'src-tauri');
const tauriConfigPath = join(tauriRoot, 'tauri.conf.json');
const tauriCargoPath = join(tauriRoot, 'Cargo.toml');
const rendererRoot = join(repoRoot, 'src');

const expectedAppName = 'WorldBuilderX';
const forbiddenRuntimeMarkers = Object.freeze([
  '@electron',
  'electron',
  'pywebview',
  'firebase',
  'supabase',
  'auth0',
  'next-auth',
]);

function readJsonFileIfPresent(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readTextFileIfPresent(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
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

function findScriptValueMatching(packageJson, pattern) {
  return Object.values(packageJson?.scripts ?? {}).find((scriptValue) => pattern.test(scriptValue));
}

function assertPathExists(path, message) {
  assert.ok(existsSync(path), message);
}

function assertScriptExists(packageJson, pattern, message) {
  assert.equal(typeof findScriptValueMatching(packageJson, pattern), 'string', message);
}

function getTauriBuildConfig(tauriConfig) {
  return tauriConfig?.build ?? {};
}

function getTauriWindows(tauriConfig) {
  return Array.isArray(tauriConfig?.app?.windows) ? tauriConfig.app.windows : [];
}

function readImplementationSurface() {
  const implementationFiles = [
    packageJsonPath,
    tauriConfigPath,
    tauriCargoPath,
    join(tauriRoot, 'Cargo.lock'),
    ...listFiles(join(tauriRoot, 'src')),
    ...listFiles(rendererRoot).filter((filePath) => ['.css', '.ts', '.tsx'].includes(extname(filePath))),
  ].filter((filePath) => existsSync(filePath) && statSync(filePath).isFile());

  return implementationFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n').toLowerCase();
}

function assertLocalDevUrl(devUrl) {
  assert.equal(typeof devUrl, 'string', 'Expected Tauri build.devUrl to be configured');
  assert.match(
    devUrl,
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/u,
    'Expected Tauri devUrl to target a local renderer dev server',
  );
}

function assertLocalFrontendDist(frontendDist) {
  assert.equal(typeof frontendDist, 'string', 'Expected Tauri build.frontendDist to be configured');
  assert.ok(!/^https?:\/\//u.test(frontendDist), 'Expected Tauri frontendDist to point at local built renderer assets');
  assert.match(frontendDist.replaceAll('\\', '/'), /(?:^|\/|\.{2}\/)dist(?:\/|$)/u);
}

const packageJson = readJsonFileIfPresent(packageJsonPath);
const tauriConfig = readJsonFileIfPresent(tauriConfigPath);

test('M0-S04 creates the standard Tauri v2 shell structure', () => {
  assertPathExists(tauriRoot, 'Expected src-tauri/ Tauri shell directory');
  assertPathExists(tauriCargoPath, 'Expected src-tauri/Cargo.toml');
  assertPathExists(join(tauriRoot, 'Cargo.lock'), 'Expected src-tauri/Cargo.lock');
  assertPathExists(join(tauriRoot, 'build.rs'), 'Expected src-tauri/build.rs');
  assertPathExists(tauriConfigPath, 'Expected src-tauri/tauri.conf.json');
  assertPathExists(join(tauriRoot, 'src', 'main.rs'), 'Expected src-tauri/src/main.rs');
  assertPathExists(join(tauriRoot, 'src', 'lib.rs'), 'Expected src-tauri/src/lib.rs');
  assertPathExists(join(tauriRoot, 'capabilities', 'default.json'), 'Expected src-tauri/capabilities/default.json');
  assertPathExists(join(tauriRoot, 'icons'), 'Expected src-tauri/icons/ directory');
});

test('M0-S04 launches the React renderer through a Tauri development npm command', () => {
  const buildConfig = getTauriBuildConfig(tauriConfig);

  assertScriptExists(packageJson, /\btauri\s+dev\b/u, 'Expected an npm script that runs tauri dev');
  assertLocalDevUrl(buildConfig.devUrl);
  assert.match(
    String(buildConfig.beforeDevCommand ?? ''),
    /\bnpm\s+run\s+dev\b/u,
    'Expected Tauri beforeDevCommand to start the npm renderer dev server',
  );
});

test('M0-S04 loads built renderer output for production-style Tauri verification', () => {
  const buildConfig = getTauriBuildConfig(tauriConfig);

  assertScriptExists(packageJson, /\btauri\s+build\b/u, 'Expected an npm script that runs tauri build');
  assertLocalFrontendDist(buildConfig.frontendDist);
  assert.match(
    String(buildConfig.beforeBuildCommand ?? ''),
    /\bnpm\s+run\s+build\b/u,
    'Expected Tauri beforeBuildCommand to build the renderer before desktop packaging',
  );
});

test('M0-S04 identifies the desktop app and default window as WorldBuilderX', () => {
  const windows = getTauriWindows(tauriConfig);

  assert.equal(tauriConfig?.productName, expectedAppName);
  assert.match(tauriConfig?.identifier ?? '', /^com\.worldbuilderx(?:\.|$)/u);
  assert.ok(windows.length > 0, 'Expected at least one Tauri window default');

  for (const windowConfig of windows) {
    assert.equal(windowConfig.title, expectedAppName);
  }
});

test('M0-S04 wires Tauri v2 npm and Rust dependencies', () => {
  const cargoToml = readTextFileIfPresent(tauriCargoPath);
  const buildRs = readTextFileIfPresent(join(tauriRoot, 'build.rs'));
  const mainRs = readTextFileIfPresent(join(tauriRoot, 'src', 'main.rs'));
  const libRs = readTextFileIfPresent(join(tauriRoot, 'src', 'lib.rs'));

  assert.match(packageJson?.devDependencies?.['@tauri-apps/cli'] ?? '', /^2\.\d+\.\d+$/u);
  assert.match(cargoToml, /tauri\s*=\s*(?:"2\.|\{[^}]*version\s*=\s*"2\.)/su);
  assert.match(cargoToml, /tauri-build\s*=\s*(?:"2\.|\{[^}]*version\s*=\s*"2\.)/su);
  assert.match(buildRs, /tauri_build::build\(\)/u);
  assert.match(mainRs, /fn\s+main\s*\(/u);
  assert.match(libRs, /tauri::Builder::default\(\)/u);
});

test('M0-S04 keeps Tauri shell code separated from renderer code', () => {
  const rendererSurface = listFiles(rendererRoot)
    .filter((filePath) => ['.css', '.ts', '.tsx'].includes(extname(filePath)))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
  const tauriRustFiles = listFiles(join(tauriRoot, 'src')).map((filePath) => relative(repoRoot, filePath));

  assert.ok(tauriRustFiles.every((filePath) => filePath.startsWith('src-tauri')), 'Expected Rust shell code under src-tauri/');
  assert.ok(!/tauri::|src-tauri|Cargo\.toml/u.test(rendererSurface), 'Expected renderer source to avoid Rust/Tauri shell concerns');
});

test('M0-S04 avoids alternate wrappers, remote backend, account, and hosted deployment assumptions', () => {
  const implementationSurface = readImplementationSurface();

  for (const marker of forbiddenRuntimeMarkers) {
    assert.ok(!implementationSurface.includes(marker), `Expected implementation surface to avoid "${marker}"`);
  }

  assert.ok(!/https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/u.test(implementationSurface));
});
