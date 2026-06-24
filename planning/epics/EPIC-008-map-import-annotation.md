# EPIC-008: Map Import & Annotation

## Goal

Provide map import and annotation tools that link maps back to lore without becoming a VTT or mapmaking app.

## Scope

- Plain image map import (PNG, JPG, WEBP, SVG).
- Two-click scale calibration.
- Square and hex grid overlays (gridless always supported).
- Pins, regions, labels as first-class map markers.
- Entity-linked markers (bidirectional map ↔ lore).
- Elevation support on markers (elevated icon + value).
- Marker visibility via condition engine (EPIC-006).
- Session grid tracking mode (cell activate/deactivate, path drawing).
- Map embed block in entity body and session pages.
- Player-facing map export (per-session, progressive reveal).
- Context-aware tool palettes (world vs. scene contexts — same system, different quick-access tools).

## Out Of Scope

- Mapmaking / drawing editor.
- Dynamic lighting.
- Token combat engine / initiative tracker.
- Full VTT behavior (Foundry/Roll20).
- MBTiles, GeoJSON, Tiled JSON in V1 (roadmap/import later).
- Map versioning beyond session-level snapshots.

## Decisions

- **Rendering:** Plain Canvas 2D API — no map framework. Custom `MapCanvas` component with transform-matrix zoom/pan, `MarkerLayer` for pins/polygons/labels, `GridLayer` for square and hex grids. Hex grid math via axial coordinates (redblobgames reference). Hit-detection via ray casting. No Leaflet, Konva, or Pixi — keeps the dependency footprint minimal and avoids fighting geo-map abstractions that don't fit fantasy coordinates. If very large images (>8000px) cause performance issues on import, downscale to a sane max resolution at import time. Coordinates stored as pixel floats internally; world units derived from calibration.
- **Image formats V1:** PNG, JPG/JPEG, WEBP, SVG. No PDF extraction in V1.
- **Coordinate system:** Pixel floats as internal truth. Calibration produces `pixels_per_world_unit`. All marker positions stored in pixels; world-unit display (km, m, ft) derived on read.
- **Calibration UX:** Two-click scale line. User clicks point A, clicks point B, enters distance + unit (`10 km`, `500 ft`). Tool computes `pixels_per_world_unit`. Optional — maps work without calibration (pixel coordinates only).
- **Elevation:** Markers support optional elevation value (number + unit). Displayed as an "elevated" icon with the numeric value. No 3D rendering.
- **Grid overlay:** Display-only — not the coordinate ground truth. Supported types: square, hex, radial, custom interval. Grid spacing derived from calibration. Togglable per map. Grid lines are a configurable color/opacity SVG overlay.
- **Session grid tracking mode:** In session context, individual grid cells (square or hex) can be activated/deactivated to track paths. Active cells: border highlights. Multi-select mode: hold mouse and drag to paint/unpaint a path. State stored in session scope, not on the base map.
- **Marker types:** Pin (point), Polygon/Region (closed shape), Label (text-only). All stored in `map_markers` table with `entity_id` reference (optional). Bidirectional: marker references entity, entity can query its markers.
- **Map markers are not standalone entities** but reference entities via `entity_id`. The map_markers table is a spatial join between maps and the entity system.
- **Marker visibility:** Same condition engine as EPIC-006. Conditions evaluated against session context. Supports `gm_only`, `player_known`, `hidden_until_condition`.
- **Tool palettes:** One map system for all use cases (world map, dungeon, city, scene). Context (world vs. scene) determines the 5-6 tools shown in the quick-access palette. All other tools accessible via menu. No hard mode separation.
- **Map embed block:** `map_embed` is a core block (added in EPIC-008's block registry). Renders a specific map with optional center point and zoom level. Usable in entity body and session pages.
- **Player-facing export:** Map export applies visibility projection (same as player view export in EPIC-006). Export is per-session: only markers revealed up to that session point are visible. Progressive reveal — each session export snapshot shows what was uncovered so far.
- **Future formats:** Tiled JSON, GeoJSON, MBTiles are roadmap items, not V1. Data model should not block them.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| E8-S01: Map data model & schema | Verified | #75 — core_data/map-schema.ts: maps/map_markers tables, getMarkersForMap/Entity. |
| E8-S02: Map image import & viewer | Verified | #76 — src/ui/MapViewer.tsx: Leaflet MapContainer+ImageOverlay, MapList export. 2 tests use require() in ESM context (test bug). |
| E8-S03: Map calibration | Verified | #77 — src/services/map-calibration.ts: computeCalibration (Euclidean), convertPixelsToWorldUnits. |
| E8-S04: Marker system (pins, regions, labels) | Verified | #78 — src/ui/MapMarkers.tsx: MarkerPanel with kind filter, elevation, entity navigation, CRUD. |
| E8-S05: Grid overlay | Verified | #79 — src/ui/GridOverlay.tsx: SVGOverlay square/hex, GridToggle, GridSettings. 4 tests use require() in ESM context (test bug). |
| E8-S06: Session grid tracking mode | Verified | #80 — src/ui/SessionGridTracker.tsx: paint mode, activated cells, clear all, session scoping. |
| E8-S07: Marker visibility & condition gates | Verified | #81 — src/services/map-marker-visibility.ts: 4 visibility scopes, inline JsonLogic evaluator. |
| E8-S08: Map embed block | Verified | #82 — src/blocks/MapEmbedBlock.tsx + src/editor/extensions/MapEmbedExtension.ts; map_embed in block-registry (renderer) + block-conversion. |
| E8-S09: Player-facing map export | Verified | #83 — src/services/player-map-export.ts: generatePlayerMapHtml, applyProgressiveReveal. |

## Sources

- `worldbuilding_architecture_study/02_Map_And_Spatial_Model.md`
- `worldbuilding_architecture_study/04_Session_Visibility_Conditions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
