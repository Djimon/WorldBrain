# EPIC-008: Map Import & Annotation

## Goal

Provide map import and annotation tools that link maps back to lore without becoming a VTT or mapmaking app.

## Scope

- Plain image map import.
- Calibration.
- Square, gridless, and likely hex grid support.
- Pins, regions, and labels.
- Entity-linked map markers.
- Marker visibility.
- Map embeds in entity/session content.

## Out Of Scope

- Mapmaking.
- Dynamic lighting.
- Token combat engine.
- Full Foundry/Roll20-style VTT behavior.
- MBTiles/GeoJSON as required V1 features.

## Open Decisions

- Whether hex grid is mandatory in the first map slice.
- Canvas/SVG/WebGL implementation choice.
- Minimum calibration UX.
- Marker visibility interaction with session state.

## Sources

- `worldbuilding_architecture_study/02_Map_And_Spatial_Model.md`
- `worldbuilding_architecture_study/04_Session_Visibility_Conditions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
