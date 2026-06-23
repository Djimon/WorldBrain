// @vitest-environment node
// Tests for issue #21: src/ must not re-export or directly import Node-only storage modules.
// See: https://github.com/Djimon/WorldBrain/issues/21
//
// The fix is to remove src/data/base-json-import.js (the re-export of core_data/base-json-import
// which uses node:fs and node:path). src/ is the Vite renderer bundle boundary; Node builtins
// must not cross it. Communication must happen via Tauri IPC commands instead.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const srcDataDir = join(projectRoot, 'src', 'data');
const coreDataDir = join(projectRoot, 'core_data');

function listFilesIn(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function readSource(directory: string, fileName: string): string {
  return readFileSync(join(directory, fileName), 'utf8');
}

const NODE_BUILTIN_PATTERN = /(?:^|['"`])node:(fs|path|os|crypto|child_process|http|https|stream|buffer|util|events|net|url|dns|tls|worker_threads)/m;

describe('issue #21: src/ renderer boundary — no Node-only imports', () => {
  it('src/data/ does not contain a re-export of base-json-import', () => {
    const files = listFilesIn(srcDataDir);
    const importFiles = files.filter((f) => f.includes('base-json-import'));

    expect(importFiles).toHaveLength(0);
  });

  it('no file in src/data/ directly imports a node: builtin', () => {
    const files = listFilesIn(srcDataDir);
    const violators: string[] = [];

    for (const fileName of files) {
      const source = readSource(srcDataDir, fileName);
      if (NODE_BUILTIN_PATTERN.test(source)) {
        violators.push(fileName);
      }
    }

    expect(violators).toEqual([]);
  });

  it('no file in src/data/ re-exports from core_data/ modules that use node:fs', () => {
    const files = listFilesIn(srcDataDir);
    const violators: string[] = [];

    const nodeUsingModules = listFilesIn(coreDataDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => NODE_BUILTIN_PATTERN.test(readSource(coreDataDir, f)))
      .map((f) => f.replace(/\.ts$/, ''));

    for (const fileName of files) {
      const source = readSource(srcDataDir, fileName);
      for (const module of nodeUsingModules) {
        if (source.includes(`core_data/${module}`) || source.includes(`../../core_data/${module}`)) {
          violators.push(`${fileName} re-exports ${module}`);
        }
      }
    }

    expect(violators).toEqual([]);
  });

  it('core_data/ modules that use node:fs are not imported by any src/ file', () => {
    const srcFiles = listFilesIn(srcDataDir);
    const nodeUsingCoreModules = listFilesIn(coreDataDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => NODE_BUILTIN_PATTERN.test(readSource(coreDataDir, f)));

    const violations: string[] = [];

    for (const srcFile of srcFiles) {
      const source = readSource(srcDataDir, srcFile);
      for (const coreModule of nodeUsingCoreModules) {
        const moduleStem = coreModule.replace(/\.ts$/, '');
        if (source.includes(moduleStem)) {
          violations.push(`src/data/${srcFile} references core_data/${moduleStem}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
