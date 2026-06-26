// @vitest-environment node
// MI-S00: Node.js Service-Layer auf Tauri Plugins migrieren
// See: https://github.com/Djimon/WorldBrain/issues/190
// Prerequisite for all MI stories — blocks #170–#180

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

// Services that currently import node:fs / node:path / node:sqlite / better-sqlite3
const NODE_API_SERVICES = [
  'src/services/app-config-service.ts',
  'src/services/db-init.ts',
  'src/services/plugin-loader.ts',
  'src/services/project-service.ts',
  'src/services/snapshot-service.ts',
  'src/services/zip-export-service.ts',
  'src/services/zip-import-service.ts',
];

function readSrc(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}

describe('MI-S00 Tauri plugin migration', () => {
  describe('package.json: required Tauri plugins', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    it('@tauri-apps/plugin-fs is in package.json', () => {
      expect(Object.keys(allDeps)).toContain('@tauri-apps/plugin-fs');
    });

    it('@tauri-apps/plugin-sql is in package.json', () => {
      expect(Object.keys(allDeps)).toContain('@tauri-apps/plugin-sql');
    });
  });

  describe('src-tauri/Cargo.toml: required Tauri plugins', () => {
    const cargo = fs.existsSync('src-tauri/Cargo.toml')
      ? fs.readFileSync('src-tauri/Cargo.toml', 'utf-8')
      : '';

    it('Cargo.toml includes tauri-plugin-fs', () => {
      expect(cargo).toMatch(/tauri-plugin-fs/);
    });

    it('Cargo.toml includes tauri-plugin-sql', () => {
      expect(cargo).toMatch(/tauri-plugin-sql/);
    });
  });

  describe('tauri.conf.json: plugins activated', () => {
    const conf = fs.existsSync('src-tauri/tauri.conf.json')
      ? fs.readFileSync('src-tauri/tauri.conf.json', 'utf-8')
      : '{}';

    it('tauri.conf.json activates plugin-fs', () => {
      expect(conf).toMatch(/fs/);
    });

    it('tauri.conf.json activates plugin-sql', () => {
      expect(conf).toMatch(/sql/);
    });
  });

  describe('services: no direct node:fs / node:path imports', () => {
    for (const filePath of NODE_API_SERVICES) {
      it(`${path.basename(filePath)} does not import from node:fs`, () => {
        const src = readSrc(filePath);
        expect(src).not.toMatch(/from ['"]node:fs['"]/);
        expect(src).not.toMatch(/require\(['"]node:fs['"]\)/);
      });

      it(`${path.basename(filePath)} does not import from node:path`, () => {
        const src = readSrc(filePath);
        expect(src).not.toMatch(/from ['"]node:path['"]/);
        expect(src).not.toMatch(/require\(['"]node:path['"]\)/);
      });
    }
  });

  describe('services: no direct node:sqlite / better-sqlite3 imports', () => {
    it('db-init.ts does not import from node:sqlite', () => {
      const src = readSrc('src/services/db-init.ts');
      expect(src).not.toMatch(/from ['"]node:sqlite['"]/);
    });

    it('no service imports better-sqlite3', () => {
      const serviceFiles = fs.readdirSync('src/services').map(f => `src/services/${f}`);
      for (const f of serviceFiles) {
        const src = readSrc(f);
        expect(src, `${f} should not use better-sqlite3`).not.toMatch(/better-sqlite3/);
      }
    });
  });

  describe('services: use @tauri-apps/plugin-fs for filesystem ops', () => {
    const FS_SERVICES = [
      'src/services/app-config-service.ts',
      'src/services/project-service.ts',
      'src/services/snapshot-service.ts',
      'src/services/zip-export-service.ts',
      'src/services/zip-import-service.ts',
    ];

    for (const filePath of FS_SERVICES) {
      it(`${path.basename(filePath)} imports from @tauri-apps/plugin-fs`, () => {
        const src = readSrc(filePath);
        expect(src).toMatch(/@tauri-apps\/plugin-fs/);
      });
    }
  });

  describe('DatabaseLike adapter', () => {
    it('a TauriSqlAdapter (or equivalent) class exists that implements DatabaseLike', () => {
      const candidates = [
        'src/services/tauri-sql-adapter.ts',
        'src/services/db-adapter.ts',
        'src/services/tauri-db-adapter.ts',
        'src/services/sql-adapter.ts',
      ];
      const exists = candidates.some(f => fs.existsSync(f));
      expect(exists).toBe(true);
    });

    it('adapter imports from @tauri-apps/plugin-sql', () => {
      const candidates = [
        'src/services/tauri-sql-adapter.ts',
        'src/services/db-adapter.ts',
        'src/services/tauri-db-adapter.ts',
        'src/services/sql-adapter.ts',
      ];
      const adapterFile = candidates.find(f => fs.existsSync(f));
      expect(adapterFile).toBeTruthy();
      const src = readSrc(adapterFile!);
      expect(src).toMatch(/@tauri-apps\/plugin-sql/);
    });

    it('adapter file implements DatabaseLike (has prepare method)', () => {
      const candidates = [
        'src/services/tauri-sql-adapter.ts',
        'src/services/db-adapter.ts',
        'src/services/tauri-db-adapter.ts',
        'src/services/sql-adapter.ts',
      ];
      const adapterFile = candidates.find(f => fs.existsSync(f));
      expect(adapterFile).toBeTruthy();
      const src = readSrc(adapterFile!);
      expect(src).toMatch(/prepare\s*\(/);
    });

    it('DatabaseLike interface in entity-service.ts is unchanged (still has prepare)', () => {
      const src = readSrc('src/services/entity-service.ts');
      expect(src).toMatch(/DatabaseLike/);
      expect(src).toMatch(/prepare\s*\(/);
    });
  });

  describe('no unknown or as never casts at service call sites', () => {
    it('db-init.ts does not contain "as unknown as any"', () => {
      const src = readSrc('src/services/db-init.ts');
      expect(src).not.toMatch(/as unknown as any/);
    });

    it('db-init.ts does not contain eslint-disable no-explicit-any', () => {
      const src = readSrc('src/services/db-init.ts');
      expect(src).not.toMatch(/eslint-disable.*no-explicit-any/);
    });

    it('no service file contains "as never" at a call site', () => {
      const serviceFiles = fs.readdirSync('src/services')
        .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .map(f => `src/services/${f}`);
      for (const f of serviceFiles) {
        const src = readSrc(f);
        expect(src, `${f} should not cast to "as never"`).not.toMatch(/\)\s*as\s+never\b/);
      }
    });
  });

  describe('build output: no node:* warnings', () => {
    it('vite.config.ts / vite.config.js does not externalize node: modules for browser build', () => {
      const viteConfig = readSrc('vite.config.ts') || readSrc('vite.config.js');
      // If the build still externalizes node: modules, Vite emits warnings.
      // After migration, no service should import node: so no externalize needed.
      expect(viteConfig).not.toMatch(/externalize.*node:/);
    });
  });
});
