// Central version strings. Prefer `appBuildVersion` in the UI — it is the canonical,
// user-facing version incl. the per-commit build counter (bumped by the pre-commit hook,
// see .githooks/pre-commit + scripts/bump-build.mjs). If you need only the marketing
// version use `appVersion`; only the counter, `appBuild`.
import { version, build } from '../../package.json';

/** Marketing version, e.g. "0.0.27". */
export const appVersion: string = version;
/** Monotonic build counter (one per commit). */
export const appBuild: number = build;
/** Canonical display version incl. build, e.g. "0.0.27.99". THE one to show in the UI. */
export const appBuildVersion = `${appVersion}.${appBuild}`;
