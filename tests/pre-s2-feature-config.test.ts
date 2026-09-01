// @vitest-environment node
// pre-release S2 (#404): feature-config mechanism — features.json + Vite build gating.
// Read-order: issue #404 → planning/epics/feature-config-release-build.md → this file → ANTI_PATTERNS.md.
//
// This builds the MECHANISM only (the 0.1 cut itself is S3). Goal: unreleased feature
// code + its libraries are really tree-shaken out of the release `dist/`, while the
// dev run (`import.meta.env.DEV`) always shows all features. See:
// https://github.com/Djimon/WorldBrain/issues/404

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { feature, FEATURE_IDS } from '../src/config/features';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const featuresJsonPath = join(projectRoot, 'features.json');

function readSrc(rel: string): string {
  return readFileSync(join(projectRoot, rel), 'utf8');
}

function readFeaturesJson(): Record<string, boolean> {
  return JSON.parse(readFileSync(featuresJsonPath, 'utf8')) as Record<string, boolean>;
}

// The four cut-able 0.1 features (Epic cut-list). The mechanism must gate these.
const GATED = ['chronicle', 'cards', 'plugins', 'rules'] as const;

// ── AC1 — features.json: flat, laien-editierbar, alle 0.1-aktiv = true ──────────
describe('#404 AC1 — features.json (flat, single source)', () => {
  it('exists at repo root', () => {
    expect(existsSync(featuresJsonPath)).toBe(true);
  });

  it('is a flat object of booleans (no per-mode {edit,play} nesting — D9)', () => {
    const cfg = readFeaturesJson();
    expect(cfg).toBeTypeOf('object');
    expect(Array.isArray(cfg)).toBe(false);
    for (const value of Object.values(cfg)) {
      expect(value).toBeTypeOf('boolean');
    }
  });

  it('has an entry per gate-able feature, all default true', () => {
    const cfg = readFeaturesJson();
    for (const id of GATED) {
      expect(cfg[id]).toBe(true);
    }
  });
});

// ── AC3/AC4 — feature(id) helper: dev=all, else the compile-constant value ──────
describe('#404 AC3/AC4 — feature(id) helper', () => {
  const originalDev = import.meta.env.DEV;
  afterEach(() => {
    (import.meta.env as { DEV: boolean }).DEV = originalDev;
  });

  it('exposes the feature ids as a central constant (no scattered string literals)', () => {
    for (const id of GATED) {
      expect(FEATURE_IDS).toContain(id);
    }
  });

  it('DEV path: returns true for every feature id (dev = all features)', () => {
    (import.meta.env as { DEV: boolean }).DEV = true;
    for (const id of FEATURE_IDS) {
      expect(feature(id)).toBe(true);
    }
  });

  it('PROD path: returns the features.json (compile-constant) value', () => {
    (import.meta.env as { DEV: boolean }).DEV = false;
    const cfg = readFeaturesJson();
    for (const id of GATED) {
      expect(feature(id)).toBe(cfg[id]);
    }
  });
});

// ── AC2 — Vite build-time injection: features.json → define constants ───────────
describe('#404 AC2 — vite build-time injection', () => {
  it('vite.config.ts reads features.json', () => {
    expect(readSrc('vite.config.ts')).toMatch(/features\.json/);
  });

  it('vite.config.ts wires a `define` with __FEATURE_ compile constants', () => {
    const src = readSrc('vite.config.ts');
    expect(src).toMatch(/define\s*:/);
    expect(src).toMatch(/__FEATURE_/);
  });

  it('vitest.config.ts injects the same define (tests share the build env)', () => {
    expect(readSrc('vitest.config.ts')).toMatch(/__FEATURE_/);
  });

  it('vite-env.d.ts declares the constants as boolean (no `any`)', () => {
    const src = readSrc('src/vite-env.d.ts');
    expect(src).toMatch(/__FEATURE_/);
    expect(src).toMatch(/const\s+__FEATURE_[A-Z]+__\s*:\s*boolean/);
  });
});

// ── AC3 (guard) + AC6 — cut mounts gated + real removal path (additional to the
//    positive feature() behavior tests above; NOT a replacement) ────────────────
describe('#404 AC3/AC6 — cut mounts gated & tree-shakeable', () => {
  const shell = () => readSrc('src/ui/WorkspaceShell.tsx');
  const features = () => readSrc('src/config/features.ts');

  it('feature(id) guard is wired into WorkspaceShell (mount gating)', () => {
    expect(shell()).toMatch(/\bfeature\(/);
  });

  it('gating resolves via the compile constant, not a pure runtime fallback (AC6)', () => {
    // real removal: the release path must read __FEATURE_*__, so Rollup can fold
    // the dead branch and drop the code + its libraries from dist.
    expect(features()).toMatch(/__FEATURE_/);
  });

  it('at least one cut feature is behind a dynamic import (tree-shakeable)', () => {
    // a static top-level `import { X } from './X'` can never be tree-shaken by flag;
    // the gated feature module must be reached via a dynamic import().
    expect(shell()).toMatch(/import\(\s*['"`]\.\/[A-Za-z]/);
  });

  it('ChronicleView is no longer a static top-level import (bundle-proof feature)', () => {
    // chronicle is the bundle-proof demo (single component, no extra services).
    expect(shell()).not.toMatch(/^import\s*\{[^}]*\bChronicleView\b[^}]*\}\s*from/m);
  });
});
