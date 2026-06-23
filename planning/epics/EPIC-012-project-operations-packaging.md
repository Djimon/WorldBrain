# EPIC-012: Project Operations & Packaging

## Goal

Make projects portable, recoverable, and eventually packageable as a desktop-like local tool.

## Scope

- ZIP import/export.
- Project folder management.
- Backup/snapshot strategy.
- Runtime/cache `.gitignore` behavior.
- Tauri v2 desktop wrapper path for M0.
- Basic packaging decision records.

## Out Of Scope

- Git UI in V1.
- Cloud sync.
- Team collaboration server.
- Desktop wrapper before the web app foundation is proven.

## Decisions

- M0 desktop wrapper baseline: Tauri v2.
- Tauri prerequisites, shell scaffold, and verification command contract should be handled by follow-up M0 stories.
- pywebview is deferred outside the M0 implementation path.
- Electron is not selected for M0 because the app does not currently need Electron's heavier Node/Chromium desktop surface.

## Open Decisions

- Snapshot timing.
- Backup retention policy.
- Project open/create UX.

## Sources

- `worldbuilding_architecture_study/08_UI_Plugin_Architecture.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
