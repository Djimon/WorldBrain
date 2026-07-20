# UI/UX Sprint — Maps Layer Panel

Presentation-only polish of `LayerPanel` (M15). No service/schema/data-model changes.

## Log

- 2026-07-20 — Typ-Chip im Row-Header statt Emoji-Icon. Das bisherige
  `layer-panel__icon` (🖼️/🌫️/🎯) hatte keine CSS-Regel -> nativ/mini gerendert und
  wirkte rechts misplaced. Ersetzt durch ein Text-Typ-Label (`Bild`/`Fog`/`Token`,
  farbcodiert) im Header. Bleibt beim Zuklappen sichtbar -> Layer-Art immer lesbar.
  Regressionstest in `m15-s02-layer-panel-mount.dom.test.tsx` (Chip vorhanden + Text).
