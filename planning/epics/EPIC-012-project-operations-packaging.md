# EPIC-012: Project Operations & Packaging

## Goal

Make projects portable, recoverable, and eventually packageable as a desktop-like local tool.

## Scope

- ZIP import/export.
- Project folder management.
- Backup/snapshot strategy.
- Runtime/cache `.gitignore` behavior.
- Future desktop wrapper path.
- Basic packaging decision records.

## Out Of Scope

- Git UI in V1.
- Cloud sync.
- Team collaboration server.
- Desktop wrapper before the web app foundation is proven.

## Open Decisions

- Snapshot timing.
- Backup retention policy.
- Tauri vs. pywebview timing.
- Project open/create UX.

## Sources

- `worldbuilding_architecture_study/08_UI_Plugin_Architecture.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
