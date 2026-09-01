// pre-release S2 (#404): shared reader for the flat, laien-editierbare features.json
// at the repo root. Both vite.config.ts and vitest.config.ts use this to expose each
// flag as a __FEATURE_<ID>__ compile constant via Vite's `define`, so a release build
// (vite build) tree-shakes unreleased feature code + its libraries out of dist/.
// Single source of truth — never scatter feature flags across the codebase.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FEATURES_JSON = new URL('../features.json', import.meta.url);

/** Read features.json → { "<id>": boolean }. */
export function readFeatures() {
  return JSON.parse(readFileSync(fileURLToPath(FEATURES_JSON), 'utf8'));
}

/**
 * Build the Vite/Vitest `define` map from features.json.
 * Each flag becomes a __FEATURE_<ID>__ compile constant whose value is the literal
 * `true`/`false` text Rollup can statically fold.
 */
export function featureDefines() {
  const cfg = readFeatures();
  /** @type {Record<string, string>} */
  const defines = {};
  for (const [id, released] of Object.entries(cfg)) {
    defines[`__FEATURE_${id.toUpperCase()}__`] = JSON.stringify(Boolean(released));
  }
  return defines;
}
