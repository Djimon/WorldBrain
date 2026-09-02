// @vitest-environment node
// pre-release S6 (#408): packaging & install-cleanliness. Config-guard — the release
// installer must ship the How-To + theme-tester as bundle.resources (they land in
// resourceDir, from where S4's ensureUserDataDirs seeds them into Documents\
// WorldsAndBeyond\), keep bundle.targets = ["nsis"], and grant resource-read so the
// seed can copy them. Issue #408 / Epic. https://github.com/Djimon/WorldBrain/issues/408

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(projectRoot, rel), 'utf8')) as Record<string, unknown>;
}

describe('#408 AC1/AC5 — tauri.conf bundle resources', () => {
  const conf = readJson('src-tauri/tauri.conf.json');
  const bundle = conf.bundle as { targets?: unknown; resources?: Record<string, string> };

  it('targets NSIS only', () => {
    expect(bundle.targets).toEqual(['nsis']);
  });

  it('ships theme-tester.html + both how-to guides as resources', () => {
    const resources = bundle.resources ?? {};
    const dests = Object.values(resources);
    expect(dests).toContain('theme-tester.html');
    expect(dests).toContain('user-guide_de.md');
    expect(dests).toContain('user-guide_en.md');
  });

  it('resource sources point at the real repo files (docs/)', () => {
    const sources = Object.keys(bundle.resources ?? {});
    for (const src of sources) {
      expect(src).toMatch(/^\.\.\/docs\//);
    }
  });
});

describe('#408 — resource-read capability (seed can copy from resourceDir)', () => {
  it('default capability grants fs:allow-resource-read-recursive', () => {
    const cap = readJson('src-tauri/capabilities/default.json');
    expect(cap.permissions).toContain('fs:allow-resource-read-recursive');
  });
});
