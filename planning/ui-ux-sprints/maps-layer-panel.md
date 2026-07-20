# UI/UX Sprint — Maps Layer Panel

Presentation-only polish of `LayerPanel` (M15). No service/schema/data-model changes.

## Log

- 2026-07-20 — Typ-Chip im Row-Header statt Emoji-Icon. Das bisherige
  `layer-panel__icon` (🖼️/🌫️/🎯) hatte keine CSS-Regel -> nativ/mini gerendert und
  wirkte rechts misplaced. Ersetzt durch ein Text-Typ-Label (`Bild`/`Fog`/`Token`,
  farbcodiert) im Header. Bleibt beim Zuklappen sichtbar -> Layer-Art immer lesbar.
  Regressionstest in `m15-s02-layer-panel-mount.dom.test.tsx` (Chip vorhanden + Text).
- 2026-07-20 — Typ-Label entpillt + zentriert. Der Pill (border/radius/bg) clippte in
  der schmalen Tab-Spalte. Jetzt schlichtes farbiges Uppercase-Label; im zugeklappten
  Zustand (`.layer-panel__row.collapsed`) fuellt es die Zeile zentriert, Name ausgeblendet
  -> Layer-Art mittig lesbar.
- 2026-07-20 — CSS fuer `MapsSidebarTabs` (#297) ergaenzt (hatte keins): Tab-Leiste
  (Karten/Ebenen) mit aktivem Unterstrich, Hover, disabled-State, scrollbarem Panel.
  `.maps-layer-section` Top-Border/Margin entfernt (Trennung kommt jetzt von der Tab-Leiste).
