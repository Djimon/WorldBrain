# Worlds and Beyond — Global UI System: Ziel, Ist-Stand, Plan

> **Zweck dieses Dokuments:** Es beschreibt — ohne Vorwissen aus irgendeiner Konversation —
> was das übergeordnete Ziel der UI-Konsolidierung ist, wo wir gerade stehen, und welche drei
> Schritte noch fehlen, um es zu erreichen. Wer hier neu reinkommt, soll danach wissen: *warum*
> wir das tun, *was schon existiert*, und *was konkret als Nächstes zu bauen ist*.

---

## 1. Das Ziel (in einem Satz)

**Ein einziges, globales, einheitliches UI-System** — jedes Widget wird aus einer kleinen Menge
geteilter **Primitives** + **Utilities** + **Tokens** komponiert, sodass praktisch **keine
pro-Komponente-CSS-Klassen mehr neu erfunden** werden, und ein Theme durch Umschreiben weniger
Variablen die *komplette* App umfärbt.

### Warum das der Endzustand sein muss
- **Theming (der eigentliche Langzeit-Zweck):** Community-baubare Themes (Obsidian-Modell) sind nur
  möglich, wenn Farben/Abstände/Radien ausschließlich über benannte Tokens laufen und die Kaskade
  vorhersehbar ist. Solange jedes Widget seine eigene CSS-Klasse mit eigenen Werten mitbringt, kann
  ein Theme nie „alles" treffen.
- **Konsistenz:** Wenn es *eine* `<Button>`-Definition gibt, sehen alle Buttons gleich aus und ändern
  sich gemeinsam. Bei ~20 handgerollten Button-Klassen driften sie auseinander.
- **Wartbarkeit / KI-Navigierbarkeit:** Eine `style.css` mit 4.000+ Zeilen wildem Wuchs ist für
  Menschen *und* Agenten schwer zu ändern, ohne Nebenwirkungen. Layer + Primitives + Utilities machen
  Änderungen lokal und berechenbar.

---

## 2. Warum der aktuelle Stand „mager" wirkt (ehrliche Diagnose)

Die bisherige Arbeit hat pro Cluster das **risikoarme, hoch-wirksame Stück** gemacht und den
**Long-tail bewusst „begründet gelassen"**. Zwei Muster erklären, warum das *noch nicht* das Zielbild ist:

1. **Viele begründete Auslassungen summieren sich.** Pro Cluster blieben Reste liegen
   (z.B. `cal-section` ×12, Audio-Buttons, Inset-Forms, Graph-Glass-Panels). Jede einzelne Auslassung
   war verteidigbar (geringe ROI, Sonderfall, Risiko) — in Summe wirkt die Fortschritts-Tabelle aber
   löchrig.

2. **Jede Migration behält bisher eine Layout-Klasse.** Die Primitives übernehmen *Aussehen + Zustand*,
   aber das *Layout* bleibt in einer abgespeckten, komponenten-eigenen Klasse hängen:
   - `.emd__item { flex-direction: column; gap: 0 }`
   - `.gsearch__result { display: grid; … }`
   - `.token-editor { position: absolute; … }`

   Genau diese Klassen sind die „neu erfundenen" CSS-Klassen, die vermieden werden sollen.

### Zielbild an einem konkreten Beispiel
```
Jetzt:  <ListRow className="emd__item">      +  .emd__item { flex-direction: column; gap: 0 }
Ziel:   <ListRow className="u-stack u-gap-0"> —  KEINE bespoke Klasse mehr
```
`.u-stack` ist eine **geteilte Kompositions-Utility**. Nach dem Umbau tragen Widgets nur noch
Primitive + generische Utilities; eine eigene Klasse existiert nur noch für *echte* Einzelfälle
(feste Pixelbreite, absolute Koordinaten eines Popovers, ein spezifisches Grid-Template, eine
per-Datensatz berechnete Farbe).

---

## 3. Was bereits existiert (Fundament — nicht neu bauen)

### 3.1 Primitives — `src/ui/primitives.tsx` + `src/styles/primitives.css`
Die kanonische Komponenten-Schicht. Alle vorhanden und in Benutzung:

| Primitive | Zweck | Wichtige Props |
|---|---|---|
| `<Button>` | jede klickbare Aktion | `tone` neutral/accent/danger · `variant` solid/outline/ghost/glass · `size` md/compact/icon · `shape` default/circle · `aria-pressed` = Einzel-Toggle · `className`-merge |
| `<Segmented>` | Toggle-Gruppe (sich ausschließend) | `value`/`options`/`onChange`/`label` · `variant` default/**glass** · `size` · `disabled` · `className` |
| `<Tabs>` | Tab-Streifen (Underline) | `activeId`/`options{id,label,disabled?}`/`onSelect`/`label` · `fill` (gleich breite Tabs) · `className` |
| `<Chip>` | Pill-Label/Tag/Facet | `tone` neutral/accent · `variant` soft/filled/outline · `size` md/sm · `selected` · `interactive` · `as` span/button |
| `<ListRow>` | auswählbare Listenzeile | `as` button/li/div · `selected` (linke Accent-Leiste + Tint) · `variant` flush/card · `interactive` |
| `<Panel>` | umrandeter Surface-Container | `variant` default/popover · `className` (Position/Padding pro Consumer) |
| `<Field>` | beschriftetes Input | `label`/`hint` (Text-Input; Standard = border-only Fokus + `--color-surface`) |
| `<StatusChip>` | status-semantischer Chip (muted/success/warning/failure) | read-only |
| `<TableSurface>` / `<ListSurface>` | scrollbare Umrandungs-Container | — |
| `NestedTree` (`src/ui/NestedTree.tsx`) | **Gold-Standard**, der Pin-Baum. Nicht ändern; das ist das End-Bild, das jeder Cluster erreichen soll. | — |

> **Regel `<Button>` forwardet keine `ref`.** Für Flyout-Trigger, die `getBoundingClientRect` brauchen,
> gehört die `ref` auf das umschließende `<div>`, nicht auf den `<Button>`.

### 3.2 Kompositions-Utilities — `src/styles/utilities.css` (bereits angelegt)
Generische Layout-Bausteine (single-class, nie komponenten-spezifisch):
```
.u-stack   flex column          .u-items-start     align-items: flex-start
.u-row     flex + align center  .u-items-stretch   align-items: stretch
.u-cluster flex wrap + center   .u-items-baseline  align-items: baseline
.u-grow    flex:1 1 auto;min-w:0 .u-justify-between justify-content: space-between
.u-gap-0 … .u-gap-4             (mappt auf --space-1 … --space-4)
```
Fehlt noch und ist bei Bedarf zu ergänzen: Grid-Helper (`.u-grid-auto`), evtl. Positionierungs-Helfer.

### 3.3 Kaskaden-Layer — `src/styles/index.css` (bereits angelegt)
Eine zentrale Einstiegsdatei legt die Layer-Ordnung **einmal** fest und weist jede Stylesheet-Datei
ihrem Layer zu, **ohne** die Dateiinhalte umzuschreiben:
```css
@layer tokens, primitives, components, utilities;   /* niedrig → hoch */
@import './tokens.css'        layer(tokens);
@import './primitives.css' layer(primitives);
@import './components/graph.css'     layer(components);
@import '../style.css'        layer(components);
@import './utilities.css'     layer(utilities);
```
`App.tsx` importiert **nur noch** `./styles/index.css`. Effekt: **Utilities gewinnen zuverlässig**
über Primitive-/Component-Regeln bei gleicher Property — genau das macht das Kollabieren von
Layout-Klassen auf Utilities deterministisch (kein Dateireihenfolge-Glücksspiel mehr).
Ziel-Runtime ist Tauri/WebView2 (Chromium), daher sind `@layer`, `light-dark()`, `color-mix()`,
`backdrop-filter` sicher nutzbar.

### 3.4 Tokens — `src/styles/tokens.css`
Bastion-Palette (tiefes Rot als Accent: `#7b1d1d` hell / `#c04b4b` dunkel), Light `:root` +
`[data-theme='dark']`. Enthält u.a. `--color-surface/-alt/-hover/-active`, `--color-accent/-strong`,
`--color-on-accent`, `--color-border`, `--color-text/-muted`, Status-Farben, `--space-1…5`,
`--radius-sm/md/pill`, `--shadow-panel`, `--color-scrim`, `--color-overlay-border`.

---

## 4. Die drei fehlenden Schritte

### Schritt 1 — Long-tail fertig (keine reinventierten Komponenten mehr)
**Ziel:** Jedes Widget nutzt das passende Primitive; „begründete Auslassungen" verschwinden bis auf
*echte* Sonderfälle.

Konkret offen (Stand jetzt):
- **Button:** `channel-row__settings-btn`, `channel-row__mixer-toggle` (Audio, `src/ui/ChannelRow.tsx`),
  `emd__create-btn` als Map-Import in `src/ui/WorkspaceShell.tsx`, `map-side-collapse-btn` (◀) und der
  vertikale `map-side-collapsed__tab`-Streifen (`src/ui/MapViewer.tsx`, `src/ui/MapsSidebarTabs.tsx`).
- **Panel:** `cal-section` (12 Verwendungen, inline Sektionen in Calendar), die zwei Inset-Forms
  `relations-tab__add-form` + `channel-row__settings-popover` (nutzen `--color-surface-alt`).
- **Chip:** `map-token__counter` (zusammengesetztes Zähler-Widget mit +/−-Stepper über Canvas).

**Echte Sonderfälle, die bespoke bleiben dürfen** (bewusst, kein Versäumnis):
- `ClipButton` (`.clip-button*`) — Kachel mit *pro-Preset berechneter* Hintergrundfarbe.
- Pin-Icon-Grid-Zellen (`.pin-icon-btn`) und Flyout-Menü-Items (`.map-tool-flyout__item`) — Grid-/Menü-Muster,
  kein Button-Primitive-Fall.
- Graph-Overlays (`.gv-panel/.gv-detail/.gv-filter-pane`) — eigenes, kohärentes `--gv-*`-Glass-System,
  scoped unter `.graph-view`; bewusst *nicht* auf `<Panel>` gezwungen (würde Radius/Border/Schatten
  verschlechtern).
- Der eingeklappte vertikale Sidebar-Streifen (`writing-mode: vertical-rl`).

**Akzeptanz:** `grep` findet keine handgerollten Button-/Row-/Chip-/Panel-Klassen mehr außer den oben
gelisteten Sonderfällen.

### Schritt 2 — Layout-Klassen auf Utilities kollabieren (gezielt, nicht flächendeckend)
**Ziel:** Wo eine Layout-Klasse **mehrfach dupliziert** ist oder zu einem migrierten Widget gehört,
wird sie durch die geteilten `.u-*`-Utilities ersetzt und **gelöscht**. Was bleibt, sind nur noch
komponenten-*spezifische* Reste (Breite, absolute Koordinaten, Grid-Template, spezielle Farbe).

> **Wichtige ROI-Grenze (2026-08, mit dem User bestätigt):** *Nicht* jede handgerollte `display:flex`-Regel
> blind auf Utilities umbauen. Einzweck-Container mit **semantischem Namen** bleiben als BEM-Klasse — z.B.
> `.entity-detail__field` (17× verwendet): eine Umstellung auf `u-stack u-gap-1` würde 17 JSX-Stellen
> verrauschen, den sprechenden Namen kosten, **nichts** fürs Theming bringen (Layout ≠ Farbe) und nur eine
> kleine Regel einsparen — also **schlechter, nicht besser**. Auch utility-first-Systeme behalten
> Komponenten-Teil-Klassen für wiederkehrende Strukturen. Das eigentliche Ziel „keine Klassen *neu
> erfinden*" war auf *reinventierte Komponenten* gemünzt (20 Button-Klassen, 9 Row-Klassen …) — und das
> ist über die Primitives + Long-tail erledigt. Utility-Kollaps daher nur bei **echter Duplikation**.

Vorgehen (pro Widget):
1. In der `.tsx` die bespoke Layout-Klasse durch Utility-Klassen ersetzen
   (`className="u-stack u-items-start u-gap-0"`).
2. In `style.css` die generischen Layout-Props aus der Klasse entfernen. Bleiben **keine** Props übrig →
   Regel ganz löschen. Bleiben spezifische Props (z.B. `width: 420px`, `position: absolute; top: 12px`)
   → nur diese behalten.
3. Verifizieren: `grep` bestätigt, dass die alte Klasse weg ist bzw. nur noch Spezifika enthält.

Beispiele:
- `.emd__item { flex-direction:column; align-items:flex-start; gap:0 }` → `u-stack u-items-start u-gap-0`,
  Klasse **gelöscht**.
- `.new-project__card` → `u-stack u-gap-4`, Klasse behält nur `width: 420px; padding: var(--space-5)`.
- `.token-editor` → `u-stack u-gap-2`, Klasse behält nur `position/top/right/width/max-height/overflow/z-index/padding`.

Ergänze Utilities nur, wenn ein echtes wiederkehrendes Muster fehlt (z.B. ein Grid-Helper). **Keine**
one-off-Utilities.

**Akzeptanz:** Reine Layout-Klassen sind verschwunden; verbleibende Klassen enthalten ausschließlich
komponenten-spezifische Werte.

### Schritt 3 — ITCSS-lite: `style.css` in Layer-Dateien splitten
**Ziel:** Die eine 4.059-Zeilen `src/style.css` wird in wartbare, thematisch getrennte Dateien unter
`src/styles/` zerlegt, jede ihrem `@layer` zugeordnet. Der theme-fähige Endzustand.

Ziel-Struktur (Vorschlag):
```
src/styles/
  index.css        (Layer-Ordnung + @import layer(...) — existiert)
  tokens.css       (Variablen — existiert)
  base.css         (Reset, body, *-box-sizing — aus style.css-Kopf)
  utilities.css    (Kompositions-Utilities — existiert)
  components/       (je Feature ein File, alle layer(components))
    entities.css  maps.css  calendar.css  audio.css  search.css  shell.css …
```
Vorgehen: **rein mechanisch verschieben**, keine Regel-Umschreibung. Blöcke aus `style.css` in die
passende Feature-Datei ausschneiden, in `index.css` per `@import … layer(components)` einhängen. Die
Layer-Zugehörigkeit garantiert, dass die Kaskade sich nicht ändert (Reihenfolge *innerhalb* eines
Layers = Import-Reihenfolge → 1:1 wie heute halten).

> **Risiko-Hinweis:** `@layer` ändert die Kaskade global (ungelayerte Regeln schlagen *alle* Layer).
> Deshalb müssen **alle** Stylesheets in Layern liegen (ist über `index.css` bereits so). Beim Splitten
> die Import-Reihenfolge in `index.css` exakt der bisherigen Datei-Reihenfolge nachbauen, sonst können
> sich bei gleicher Spezifität Gewinner ändern. Nach jedem Split-Commit visuell prüfen.

**Akzeptanz:** `style.css` ist aufgelöst; jede Feature-Datei ist überschaubar; `vite build` grün;
`@layer` im Output erhalten; App sieht unverändert aus.

---

## 5. Arbeitsweise / Konventionen (bei jedem Commit)
- **Verhaltens-erhaltend.** Wert-identische CSS-Swaps. Jede *bewusste* optische Angleichung dem User
  zum Anschauen melden (er verifiziert visuell in der laufenden Tauri-App — dieser Agent kann Tauri/SQLite
  hier nicht booten, daher: `npx tsc --noEmit` + `eslint` + gezielte `vitest`-Läufe + `vite build`).
- **Node/Toolchain:** `export PATH="/c/Program Files/nodejs:$PATH"`; Node 24.17.0. Bash-Tool nutzen,
  nicht PowerShell. Pre-commit-Hook läuft tsc+eslint und blockt bei Fehlern.
- **Tests gegen Baseline prüfen:** Es gibt vorbestehende, *nicht* von dieser Arbeit verursachte
  Fehlschläge (u.a. `m2-s06/s07/s12` `.status`-Crash = Issue #343; `m2-s05` `tagSchema`-ReferenceError;
  `m2-s11` sync-Mock/async; `m5-s02` stale Wizard; `m15-s06` Schema-Drift; `m11-s04` ENOENT). Bei
  Test-Fehlern **immer** per `git stash` gegen die Baseline diffen, bevor man die eigene Änderung
  verdächtigt.
- **Commits:** `refactor(ui-consolidation): …` (oder `feat`/`fix`), Body endet mit
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Verifizieren:** nach jeder Migration per `grep` prüfen, dass die alte Klasse aus `.tsx` UND `style.css`
  weg ist und selbst-gestylte Nachbar-Widgets überleben.

---

## 6. Stand & Reihenfolge

**Erledigt:**
1. ✅ **Schritt 1 (Long-tail)** — keine reinventierten Button/Panel-Klassen mehr außer echten Specials.
   Audio-Buttons (settings/mixer/mute), Map-Import, cal-section (5×), Inset-Forms sind auf Primitives.
2. ✅ **Fundament** — `@layer`-Ordnung (`styles/index.css`) + Kompositions-Utilities (`styles/utilities.css`).
3. ✅ **Schritt 2 gezielt** — Layout-Duplikation der migrierten Widgets auf Utilities kollabiert
   (`.emd__item` ganz gelöscht; entity-picker/mention/backlinks/new-project/token-editor/cal-section
   reduziert). **Bewusst NICHT** flächendeckend (siehe ROI-Grenze oben).

4. ✅ **Schritt 3 (ITCSS-Split)** — `style.css` (3.985 Zeilen) in 10 Feature-Dateien unter `src/styles/`
   zerlegt (`base.css` + `components/{shell,entities,search,calendar,maps,calendar-extras,maps-panels,
   audio,pickers}.css`), alle via `styles/index.css` in `layer(components)` in **exakter** Original-
   Reihenfolge → Kaskade byte-identisch (per Konkatenations-Diff verifiziert). `style.css` gelöscht.

**Damit ist der theme-fähige Endzustand erreicht:** tokens → primitives → components (Feature-Dateien)
→ utilities, alle unter `@layer`, Farben über Tokens. Ein Community-Theme = eine Datei, die die
`--color-*`/`--space-*`/`--radius-*`-Variablen überschreibt.

**Verbleibend = nur bewusste Specials + opportunistischer Feinschliff** (kein eigener Schritt):
ClipButton (per-Preset-Farbe), Graph-`--gv-*`-Glass, pin-icon-Grid, Flyout-Menüs, vertikaler Sidebar-
Streifen; sowie punktueller Utility-Kollaps, falls irgendwo echte Duplikation auffällt. Der
flächendeckende Flex→Utility-Sweep wird bewusst **nicht** verfolgt (ROI-Grenze oben).


