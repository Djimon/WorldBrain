# EPIC-001: Project Foundation & Local App Shell

## Goal

Establish the local application foundation: React/TypeScript web app, basic app shell, visual baseline, project navigation, and development conventions.

## Scope

- Local web app reference architecture.
- Tauri v2 as the M0 desktop wrapper baseline around the React/TypeScript renderer.
- App shell, header, main workspace, panels, and view routing.
- Visual design foundation based on the Bastion Manager style.
- Baseline project structure, lint/test/build commands, and developer workflow.

## Out Of Scope

- Alternative desktop wrappers for M0.
- Full plugin system.
- Full feature views beyond shell-level placeholders.

## Decisions

- M0 desktop wrapper baseline: Tauri v2.
- Renderer baseline remains Vite + React + TypeScript.
- Package manager remains npm.
- pywebview is not used for the M0 implementation path.
- Electron remains a viable alternative outside M0, but is not selected because its bundled Chromium/Node footprint is heavier than the current desktop-first local app needs.
- A later webapp/cloud port remains possible because renderer code must stay separated from native shell concerns.

## Open Decisions

- Initial app scaffold/tooling choice.
- Minimum UI component library vs. custom primitives.

## Sources

- `worldbuilding_architecture_study/00_Master_Overview.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
- `worldbuilding_architecture_study/13_Visual_Design_System.md`
