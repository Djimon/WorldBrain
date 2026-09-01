// pre-release S2 (#404): central feature gate. Single source of truth for which
// features ship in a release build.
//
// The flag values come from the flat, laien-editierbare `features.json` at the repo
// root, injected by vite.config.ts / vitest.config.ts as __FEATURE_<ID>__ compile
// constants (see scripts/feature-defines.mjs + src/vite-env.d.ts). In a release build
// (`vite build`, i.e. every CI release) Rollup statically folds those constants, so
// a feature switched off is tree-shaken — its code AND its libraries never reach dist/.
//
// Dev runs (`tauri dev` / `vite`, where import.meta.env.DEV === true) always show ALL
// features, regardless of features.json — no extra flag needed.
//
// NOTE the two layers, both derived from the SAME constants:
//   - feature(id) — runtime helper for the sidebar/visibility gate (WorkspaceShell).
//   - the lazy dynamic-import mounts in WorkspaceShell read the __FEATURE_<ID>__
//     constant DIRECTLY, because only a directly-inlined constant lets Rollup fold
//     the dead branch and drop the import() chunk. A function call there would not
//     be statically analyzable and the code would stay in the bundle.

export const FEATURE_IDS = ['chronicle', 'cards', 'plugins', 'rules', 'audio'] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

// Release values from the compile constants (see vite-env.d.ts). Never read in the
// DEV path below, so this map is safe even though the constants are build-injected.
const RELEASED: Record<FeatureId, boolean> = {
  chronicle: __FEATURE_CHRONICLE__,
  cards: __FEATURE_CARDS__,
  plugins: __FEATURE_PLUGINS__,
  rules: __FEATURE_RULES__,
  audio: __FEATURE_AUDIO__,
};

/** True if the feature is available in the current build. Dev = all features. */
export function feature(id: FeatureId): boolean {
  return import.meta.env.DEV ? true : RELEASED[id];
}

/** Narrow an arbitrary area id to a gate-able FeatureId. */
export function isGatedFeature(id: string): id is FeatureId {
  return (FEATURE_IDS as readonly string[]).includes(id);
}
