# UI bauen — Kurzanleitung für Devs

## ⛔ Grundregel (hart)
**Keine neuen CSS-Klassen und keine hardcodierten Farben/Größen ohne ausdrückliche Freigabe.**
Neue UI wird aus vorhandenen **Primitives + Utilities + Tokens** komponiert. Wenn dir etwas fehlt →
**fragen**, dann erweitern wir das Primitive/Utility zentral. Kein `background:#fff`, kein
`.mein-neues-panel { … }` auf eigene Faust.

## So baust du neue UI (in dieser Reihenfolge)
1. **Primitive nehmen** — `src/ui/primitives.tsx`:
   `<Button>` · `<Segmented>` · `<Tabs>` · `<Chip>` · `<ListRow>` · `<Panel>` · `<Field>` · `<StatusChip>` ·
   `<TableSurface>`/`<ListSurface>`. Bäume → `NestedTree`.
2. **Layout mit Utilities** — `src/styles/utilities.css`:
   `.u-stack` · `.u-row` · `.u-cluster` · `.u-grow` · `.u-noshrink` · `.u-items-start/-end/-baseline/-stretch` ·
   `.u-justify-between` · `.u-gap-0…4`. (z.B. `<Panel className="u-stack u-gap-3">`.)
3. **Farben/Abstände nur über Tokens** — `src/styles/tokens.css`:
   `var(--color-accent | -surface | -surface-alt | -border | -text | -text-muted | -on-accent | …)`,
   `var(--space-1…5)`, `var(--radius-sm/md/pill)`, `var(--shadow-panel)`. **Niemals** rohe Hex/px für Farbe.

## Wann DOCH eine Klasse ok ist
Nur für **komponenten-spezifische Reste**, die keine Utility abbildet: feste `width`, absolute
Positionierung (`top/right/z-index`), ein Grid-Template, eine per-Datensatz berechnete Farbe. Alles andere
(flex/gap/align, Farben, Radien) → Utility/Token. Und auch diese Rest-Klassen bitte vorher kurz absegnen lassen.

## Wenn nichts passt
Nicht bespoke nachbauen — **melden**. Ein fehlender Fall heißt: das Primitive braucht eine Variante oder
es fehlt eine Utility. Das wird **zentral** ergänzt (mit Freigabe), damit alle davon profitieren und das
System einheitlich + theme-fähig bleibt.

## Warum
Alle Farben laufen über Tokens, die Kaskade ist über `@layer` geregelt (`src/styles/index.css`). Dadurch
färbt **eine** Theme-Datei (nur Variablen-Overrides) die ganze App um. Jede eigenmächtige Klasse oder
hardcodierte Farbe reißt ein Loch in dieses System — genau deshalb die Grundregel oben.
