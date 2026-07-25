# UI/UX Sprint — Fog Toolbar

Presentation-only polish of `FogTools` (M15 fog paint toolbar). No service/schema/data-model changes.

## Changes

- **2026-07-25**: Hide brush-size/feather sliders unless `shape` is `brush` or `square`.
  Rationale (user): `region` and `grid-stamp` have their own applicable settings
  (region = drag-to-fill, no brush concept; grid-stamp = `stampLevel`) — brushSize/feather
  don't apply to either and were shown regardless of active shape, which read as
  unused/confusing controls.
