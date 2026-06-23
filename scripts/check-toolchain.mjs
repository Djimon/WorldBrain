import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const expectedNodeVersion = readFileSync(join(repoRoot, '.node-version'), 'utf8').trim();
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const expectedPackageManager = packageJson.packageManager;
const expectedNpmVersion = expectedPackageManager?.match(/^npm@(.+)$/u)?.[1];

function run(command, args, label) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(`Required command is not available: ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

if (!expectedNpmVersion) {
  throw new Error('package.json must declare packageManager as npm@<version>');
}

function readNpmVersion() {
  if (process.platform === 'win32') {
    return run('cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version'], 'npm');
  }

  return run('npm', ['--version'], 'npm');
}

assertEqual(run('node', ['--version'], 'node').replace(/^v/u, ''), expectedNodeVersion, 'Node version');
assertEqual(readNpmVersion(), expectedNpmVersion, 'npm version');

console.log(`Node ${expectedNodeVersion} and npm ${expectedNpmVersion} are available.`);
