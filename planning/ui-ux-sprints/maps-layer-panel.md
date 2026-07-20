# UI/UX Sprint — Maps Layer Panel

Presentation-only polish of `LayerPanel` (M15). No service/schema/data-model changes.

## Endzustand (2026-07-20)

Nach mehreren verworfenen CSS-Anläufen (siehe "Reizpunkt" unten) ist der finale,
funktionierende Stand:

- **Row-Header** (Default-Inline-Fluss, dann flex): `[▶/▼] [Name links, wächst, Ellipsis]
  [🚫 wenn ausgeblendet] [Typ-Pill rechts]`. Typ-Pill = farbiger Text + Rand, rund
  (Bild blau / Fog grau / Token orange).
- **Default zugeklappt** (`expanded`-Set, per Layer-ID → überlebt Live-Reload).
- **Controls** (nur aufgeklappt), von oben: Name-Input (bestehende Form-Input-Konvention),
  Deckkraft, Ausblenden/Einblenden, Spielersichtbar, Bemalen (fog) / Verschieben (image),
  Nach oben/unten, Löschen (Inline-Confirm). Name speichert on Blur/Enter.
- **Toolbar** `+ Map Layer` / `+ Fog Layer`: flex-wrap → nebeneinander wenn Platz, sonst
  gestapelt.
- **Token-Layer** aus der Liste gefiltert (systemisch, genau 1 pro Map, wie Pin-Layer).
- **Resizable Sidebar** (Splitter, wie Pin-Tree-Resize) in `WorkspaceShell` (maps-Case).
- Tab-CSS für `MapsSidebarTabs` (#297) vorhanden.

## Reizpunkt / Root Cause (wichtig für später)

Der Typ-Chip/Indikator "verschwand" wiederholt. **Ursache war NICHT das Chip-CSS**, sondern:
`.workspace-area__sidebar ul li button { width: 100% }` (Karten-Listen-Button-Style) leakt
auf die LayerPanel-Buttons (Panel ist auch `ul > li > button` in der Sidebar). Der
Collapse-Pfeil wurde dadurch voll breit → Name/Chip/Indikator brachen um bzw. wurden mit
`display:flex` rausgeschoben/geclippt. Fix: höher-spezifischer Override
`.layer-panel__row-header .layer-panel__collapse { width: auto }`. Erst danach war Header-Flex
gefahrlos. Lehre: bei "verschwundenen"/umgebrochenen Elementen zuerst geerbte/geleakte
globale Regeln prüfen, nicht am eigenen CSS raten.
