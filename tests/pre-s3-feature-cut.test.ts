// @vitest-environment node
// pre-release S3 (#405): the 0.1 cut — chronicle/cards/plugins-UI/rules switched OFF in
// features.json so their code is tree-shaken out of the release build (the gating wiring
// itself was built in S2 #404). The plugin SUBSTRATE stays wired (only the PluginManager
// UI is cut). Read-order: issue #405 → planning/epics/feature-config-release-build.md →
// this file → ANTI_PATTERNS.md. https://github.com/Djimon/WorldBrain/issues/405

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENTITY_TYPE_SCHEMAS } from '../src/data/entity-type-schemas';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
function readSrc(rel: string): string {
  return readFileSync(join(projectRoot, rel), 'utf8');
}
function readFeaturesJson(): Record<string, boolean> {
  return JSON.parse(readFileSync(join(projectRoot, 'features.json'), 'utf8')) as Record<string, boolean>;
}

// ── AC1 — the four cut features are OFF; the actively-shipping ones stay ON ──────
describe('#405 AC1 — 0.1 cut values in features.json', () => {
  const CUT = ['chronicle', 'cards', 'plugins', 'rules'] as const;
  const KEEP = ['audio', 'graph', 'maps', 'session'] as const;

  it('cut features are false', () => {
    const cfg = readFeaturesJson();
    for (const id of CUT) {
      expect(cfg[id]).toBe(false);
    }
  });

  it('actively-shipping gate-able features stay true', () => {
    const cfg = readFeaturesJson();
    for (const id of KEEP) {
      expect(cfg[id]).toBe(true);
    }
  });
});

// ── AC3 — the plugin SUBSTRATE is NOT removed (only the PluginManager UI is cut) ─
describe('#405 AC3 — plugin substrate stays intact', () => {
  it('entity-type-schemas still provides the core entity types', () => {
    // The substrate that feeds Character/Location/… field schemas must survive the
    // plugins-UI cut, otherwise entities lose their types in the release.
    for (const type of ['Character', 'Location', 'Faction', 'Item']) {
      expect(ENTITY_TYPE_SCHEMAS[type]).toBeDefined();
    }
  });

  it('WorkspaceShell wires the substrate unconditionally (not behind the plugins gate)', () => {
    // plugin-entity-service (listEntityTypes) is a plain top-level import — the `plugins`
    // gate only makes the PluginManager UI lazy, never the substrate services.
    const shell = readSrc('src/ui/WorkspaceShell.tsx');
    expect(shell).toMatch(/^import \{ listEntityTypes \} from '\.\.\/services\/plugin-entity-service';/m);
    // PluginManager (the cut UI) is the lazy, __FEATURE_PLUGINS__-gated one.
    expect(shell).toMatch(/const PluginManager = import\.meta\.env\.DEV \|\| __FEATURE_PLUGINS__/);
  });
});

// ── AC5 — the edit-mode session pointer is removed ──────────────────────────────
describe('#405 AC5 — edit session pointer removed', () => {
  it('session is excluded from the edit menu (still in PLAY_AREAS for play)', () => {
    const shell = readSrc('src/ui/WorkspaceShell.tsx');
    expect(shell).toMatch(/a\.id !== 'play-settings' && a\.id !== 'session'/);
    // session remains a play area (the cockpit).
    expect(shell).toMatch(/const PLAY_AREAS: Area\[\] = \[[^\]]*'session'/);
  });

  it('the orphaned sessionAreaEditHint i18n key is gone (no dangling key)', () => {
    expect(readSrc('src/locales/de/nav.json')).not.toMatch(/sessionAreaEditHint/);
    expect(readSrc('src/locales/en/nav.json')).not.toMatch(/sessionAreaEditHint/);
    expect(readSrc('src/ui/WorkspaceShell.tsx')).not.toMatch(/sessionAreaEditHint/);
  });
});
