/// <reference types="vite/client" />

// pre-release S2 (#404): build-time feature flags. vite.config.ts / vitest.config.ts
// inject these from features.json via `define` (see scripts/feature-defines.mjs).
// Consumed by src/config/features.ts and the lazy mounts in WorkspaceShell.tsx.
declare const __FEATURE_CHRONICLE__: boolean;
declare const __FEATURE_CARDS__: boolean;
declare const __FEATURE_PLUGINS__: boolean;
declare const __FEATURE_RULES__: boolean;
declare const __FEATURE_AUDIO__: boolean;
