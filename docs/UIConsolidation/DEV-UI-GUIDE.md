# UI bauen — Kurzanleitung für Devs

## ⛔ Grundregel (hart)
**Keine neuen CSS-Klassen und keine hardcodierten Farben/Größen ohne ausdrückliche Freigabe.**
Neue UI wird aus vorhandenen **Primitives + Utilities + Tokens** komponiert. Wenn dir etwas fehlt →
**fragen**, dann erweitern wir das Primitive/Utility zentral. Kein `background:#fff`, kein
`.mein-neues-panel { … }` auf eigene Faust.

## ⛔ Kein Inline-`style={{…}}` für Layout/Farbe (Schlupfloch — verboten)
Das `style`-Attribut ist **kein** erlaubter Ausweg um die „keine neuen Klassen"-Regel herum. Verboten:
`style={{ flex: 1, minHeight: 0, overflow: 'auto', maxWidth: '100%', borderLeft: '1px solid …', padding: … }}`
und jede andere Layout-/Farb-/Größen-Angabe inline.

**Warum härter als eine bespoke Klasse:** Inline-Styles schlagen `@layer` komplett — sie sind
**un-themebar und nicht wiederverwendbar**. Ein Community-Theme kann sie nie überschreiben. Damit reißen
sie ein *größeres* Loch ins System als eine eingelagerte Klasse.

**Wenn eine Utility fehlt** (z.B. `overflow-y`, `min-height:0`, ein Divider): **nicht** inline hardcoden →
**melden**, dann wird die Utility **zentral** in `src/styles/utilities.css` ergänzt (mit Freigabe).
Braucht ein Widget einen echten Einzelfall-Rest (feste Breite, absolute Position, Grid-Template), kommt der
in eine **abgesegnete** komponenten-spezifische Klasse (siehe unten) — nicht ins `style`-Attribut.

> Einzige tolerierte Ausnahme: ein **wirklich dynamischer, pro-Render berechneter** Wert, der keine Klasse
> sein *kann* (z.B. `style={{ transform: \`translate(${x}px,${y}px)\` }}` für eine Live-Position, eine
> per-Datensatz berechnete Farbe). Statische Werte („`maxWidth:'100%'`", „`flex:1`") sind **kein** solcher Fall.

## So baust du neue UI (in dieser Reihenfolge)
1. **Primitive nehmen** — `src/ui/primitives.tsx`:
   `<Button>` · `<Segmented>` · `<Tabs>` · `<Chip>` · `<ListRow>` · `<Panel>` · `<Field>` · `<StatusChip>` ·
   `<TableSurface>`/`<ListSurface>`. Bäume → `NestedTree`.
2. **Layout mit Utilities** — `src/styles/utilities.css`:
   Flow: `.u-stack` · `.u-row` (flex+align-center) · `.u-cluster` (wrap+center) · `.u-wrap` (wrap, align-neutral).
   Flex-Kind: `.u-grow` · `.u-noshrink` · `.u-flex-1`. Align: `.u-items-start/-end/-baseline/-stretch` · `.u-justify-between`.
   Abstand: `.u-gap-0…4`. Sonst: `.u-scroll-y` · `.u-min-h-0` · `.u-hidden` · `.u-relative` · `.u-clickable`.
   (z.B. `<Panel className="u-stack u-gap-3">`.)
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

## Durchsetzung (die Regeln knallen jetzt maschinell)
`npm run lint` (und der Pre-commit-Hook) blocken **neuen** Code bei zwei Verstößen — nicht nur Doku:

**Beide Gates stehen auf 0 — es gibt keine Baseline, keinen geduldeten Alt-Bestand.** Jeder Verstoß,
alt oder neu, bricht den Commit. Nicht „später aufräumen", nicht wegdrücken.

- **Gate 1 — hardcodierte Farbe.** `scripts/check-hardcoded-colors.mjs`: rohe `#hex`/`rgb()`/`hsl()` in
  CSS (außer `tokens.css` + `themes/`) → **BLOCKED**. Fehlt ein Token? → in `src/styles/tokens.css`
  anlegen und `var(--…)` nutzen. Neutrale Schatten/Scrims: `color-mix(in srgb, var(--color-shadow) N%, transparent)`.
- **Gate 2 — statisches Inline-`style`.** ESLint-Rule `local/no-static-inline-style`: `style={{…}}` mit
  ausschließlich statischen Werten → **error**. Dynamische Werte (Variablen, `${…}`, berechnet) gehen durch —
  das ist die einzige Ausnahme. Statik gehört in Utility/Token/Klasse.

Das ist der Sinn: Die Regel hängt nicht mehr daran, dass jeder Agent im Einzelmoment nachschaut —
ein Rückfall landet nicht mehr still, sondern bricht den Commit.

> **Kein Schummeln.** Keine Baseline/Suppression-Datei wiederbeleben, kein `--pass-on-unpruned-suppressions`,
> keine flächendeckenden `eslint-disable`. Wenn ein Fall wirklich nicht anders geht, ist es genau **eine**
> Zeile mit begründeter Freigabe: `// eslint-disable-next-line local/no-static-inline-style -- <Grund + Freigabe>`
> — und die braucht meine Zustimmung. Der Normalfall ist: sauber lösen.
