# Visual Design System

## Quelle und Ziel

Dieses Dokument extrahiert die brauchbaren Design-Prinzipien aus dem bestehenden Bastion-Manager-CSS:

```text
C:/Users/Anwender/PycharmProjects/DnDBastionManager/app/html/css/style.css
```

Ziel ist keine 1:1-Uebernahme. WorldBuilderX wird mehr Entity-Typen, Views, Editorflaechen und Spezialwerkzeuge haben. Der Bastion-Stil ist deshalb die visuelle Basis: ruhig, dicht, leicht fantasy-nah, aber weiterhin ein produktives Tool fuer wiederholte Nutzung.

## Design-DNA

Der Stil funktioniert, weil er drei Ebenen sauber kombiniert:

1. **Tool-UI zuerst:** viel Oberflaeche, wenig Dekoration, klare Panels, Tabellen, Tabs und Listen.
2. **Leichte Fantasy-Anmutung:** serifige Ueberschriften, burgunderrote Akzente, warme Statusfarben.
3. **Dichte Information:** kompakte Spacing-Werte, viele kleine Badges, Statuszeilen, Metadaten und Scrollbereiche.

Die Atmosphaere ist "GM-Arbeitstisch", nicht Landingpage, Game-Menu oder generisches SaaS.

## Farbmodell

Das bestehende CSS ist stark tokenisiert. Das sollte beibehalten und fuer WorldBuilderX erweitert werden.

| Rolle | Light | Dark | Verwendung |
|---|---:|---:|---|
| Primary Text / Ink | `#1f2326` | `#e7e2d8` | Haupttext, Headlines, wichtige Labels |
| Accent | `#7b1d1d` | `#c04b4b` | Primaeraktionen, aktive Tabs, linke Akzentlinien |
| Accent Strong | `#5f1515` | `#e06b6b` | Hover/Pressed |
| Surface | `#ffffff` | `#1f2428` | Panels, Cards, Inputs |
| Surface Alt | `#f7f8fa` | `#232a30` | verschachtelte Panels, Tabellenkopf, Sidebars |
| App Background | `#f2f3f5` | `#15181b` | Hauptflaeche |
| Border | `#d5d8dd` | `#2f363d` | Panelgrenzen, Tabellenlinien, Trenner |
| Success | `#3c6f55` | `#7cc19b` | positive Checks, valide Zustaende |
| Warning | `#a06b1f` | `#e0b66b` | offene Aufgaben, Preview, Dirty States |
| Failure | `#9f3a2e` | `#e29a93` | Fehler, Konflikte, gefaehrliche Hinweise |

Regel: Der Akzent darf fuehren, aber nicht alles faerben. Die meisten Flaechen bleiben neutral. Statusfarben sind zweckgebunden.

## Typografie

Empfohlene Stack-Aufteilung:

```css
body {
    font-family: "Source Sans 3", "Work Sans", "Gill Sans", "Segoe UI", sans-serif;
}

h1,
h2,
h3,
h4,
legend {
    font-family: "Crimson Text", "Libre Baskerville", "Times New Roman", serif;
}

code,
.log,
.mono {
    font-family: "Source Code Pro", "Fira Mono", "Courier New", monospace;
}
```

Guidelines:

- Serif nur fuer Abschnittstitel, Dialogtitel, Paneltitel und wichtige semantische Namen nutzen.
- Sans fuer alle interaktiven und dichten UI-Bereiche.
- Monospace fuer Logs, IDs, technische Debug-Ausgaben, Importvalidierung.
- Kleine Metadatenlabels liegen bei `0.75rem` bis `0.85rem`, oft `font-weight: 600`.

## Layout-Prinzipien

WorldBuilderX sollte die Bastion-Manager-Struktur uebernehmen, aber generischer denken:

| Ebene | Muster |
|---|---|
| App Shell | Header + flexible Hauptflaeche + optionale Status-/Dev-Leiste |
| Arbeitsflaechen | Vollhoehe, `overflow: hidden`, innere Panels scrollen selbst |
| Hauptviews | Grid/Flex mit Sidebars, Detailpane, Inspector oder Logpane |
| Panels | `surface`/`surface-alt`, 1px Border, 8-12px Radius, moderate Schatten |
| Listenitems | kompakt, optional linke Accent-Border, Hover mit Surface-Wechsel |
| Dichte Werkzeuge | feste Hoehen/Scrollbereiche statt wachsende Seiten |

Das Tool sollte keine Marketing-Heroes, grossen dekorativen Cards oder einfarbigen Atmosphaerenflaechen verwenden. Der Stil lebt von nutzbarer Dichte.

## Spacing und Radius

Standardwerte:

| Token | Wert | Verwendung |
|---|---:|---|
| `--space-1` | `0.25rem` | Mikroabstand, Icon/Text |
| `--space-2` | `0.5rem` | Button-Gaps, Listenabstand |
| `--space-3` | `0.75rem` | kompakte Card-/Row-Paddings |
| `--space-4` | `1rem` | Standard-Panel-Padding |
| `--space-5` | `1.5rem` | groessere Dialog-/View-Paddings |
| `--radius-sm` | `6px` | Tags, Inputs, kleine Controls |
| `--radius-md` | `8px` | Buttons, kompakte Cards |
| `--radius-lg` | `10px` | Panels, Listencontainer |
| `--radius-xl` | `12px` | Dialoge, groessere Management-Panels |

Runde Pillen (`999px`) nur fuer Badges, Toggles, runde Iconbuttons und Statuschips.

## Kernkomponenten

### Buttons

Buttons sind kompakt, rechteckig, 8px Radius, `min-height: 36px`, `font-weight: 600`.

Varianten:

- Primary: Accent-Fill fuer Hauptaktionen.
- Secondary: neutrale Surface-Alt-Flaeche fuer haeufige Nebenaktionen.
- Ghost: transparenter Hintergrund mit Accent-Border.
- Success/Danger: nur fuer semantische Aktionen.
- Iconbutton: quadratisch oder rund, fuer Tools, Filter, Theme, Collapse.

### Panels und Cards

Panels sind Arbeitsbereiche. Cards sind wiederholte Items.

Regeln:

- Panels: `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 10px`.
- Subpanels: `surface-alt`.
- Wichtige aktive Items: linke `3px` Accent-Border.
- Warnings/Previews: linke `4px` Warning-Border.
- Keine Cards in Cards, ausser klar verschachtelte Editorgruppen mit reduziertem Styling.

### Tabs

Tabs liegen in einer neutralen Leiste:

- Container: `surface-alt`, Border, Radius, kleines Padding.
- Inaktive Tabs: transparent, Text-Light.
- Hover: `surface`, Text-Dark.
- Aktiv: Accent-Fill, Text-On-Accent.

Dieses Muster eignet sich fuer Entity-Details: Overview, Relations, Timeline, Map Pins, Sessions, Notes, Rules.

### Forms

Inputs:

- `surface`, `border`, `8px` Radius.
- Focus: Accent-Border + dezenter Accent-Shadow.
- Labels sind klein, semibold, klar ueber dem Feld.
- Lange Formulare werden in Panels oder responsive Grids geteilt.

Dirty/Changed State:

- linke Warning-Border
- `status-warn-bg`
- Feldborder optional Warning

### Tables und Listen

Tabellen sind fuer dichte Verwaltung wichtig:

- `border-collapse: collapse`
- Header auf `surface-alt`
- Zeilen mit Bottom-Border
- Hover auf `surface-alt`
- Sortierindikatoren rechts im Header

Listenitems:

- `surface-alt` oder `surface`
- 8-10px Radius
- 1px Border
- aktive Items mit Accent-Border und leichter Inset-Markierung

### Badges, Tags und Status

Tags sind kleine inline-flex Elemente mit 6px Radius. Statuschips sind Pills.

Statusrollen:

- `status-good`: valide, abgeschlossen, sichtbar
- `status-warn`: offen, geaendert, Preview
- `status-muted`: inaktiv, unbekannt, optional
- `status-fail`: Fehler, Konflikt, nicht erfuellt

### Modals

Dialoge sollen wie Werkzeuge wirken, nicht wie grosse Landingpage-Karten:

- Overlay `rgba(0,0,0,0.5)`
- Content `surface`, `12px` Radius, linke Accent-Border
- Header mit Bottom-Border
- Body scrollt intern
- Footer rechts ausgerichtet

### Toasts und Logs

Toasts:

- unten rechts
- `surface`, Border, Shadow
- linke Status-Border
- max Breite begrenzen

Logs:

- Monospace nur bei technischen Logs.
- Spiel-/Session-Logs koennen Sans bleiben, aber mit kompakten Statusfarben.

## View-Muster fuer WorldBuilderX

Empfohlene Standard-Views:

| View | Layout |
|---|---|
| Entity Browser | linke Filter-/Typ-Sidebar, mittlere Liste/Tabelle, rechter Inspector |
| Entity Detail | Header mit Titel/Badges, Tabs darunter, scrollbarer Content |
| Map View | grosse Kartenflaeche, schmale Layer-/Pin-Sidebars, Inspector |
| Timeline | horizontal/vertikal scrollbarer Hauptbereich, Filterpanel |
| Session Mode | Live-Konsole mit sichtbaren/verdecken Notizen, Log, Player-Handouts |
| Rules/Reference | Suchliste + Detailpane + relationale Links |
| Import/Validation | Ergebnisliste, Fehlerchips, Vorschau, Apply/Reject Controls |

## Responsive Regeln

Das bestehende CSS nutzt sinnvolle Breakpoints:

- `1600px` und `1200px`: Breiten von Sidebars/Inventory anpassen.
- `1024px`: mehrspaltige Arbeitsflaechen zu einspaltigem Stack.
- `768px`: Header stapeln, Formulare einspaltig, kompaktere View-Paddings.
- Hoehenbreakpoint um `820px`: Log-/Kontrollbereiche begrenzen.

Fuer WorldBuilderX gilt:

- Desktop ist der Primaerfall.
- Mobile muss lesbar sein, aber komplexe Workflows duerfen gestapelt werden.
- Jede Hauptflaeche braucht definierte `min-height: 0` und interne Scrollcontainer, damit Tabs, Karten und Logs nicht das Layout sprengen.

## Encoding-Hinweis

Im Quell-CSS erscheinen einige Pfeile als Mojibake, z.B. falsch dekodierte Dreieck- und Chevron-Zeichen. Fuer WorldBuilderX sollten solche UI-Zeichen nicht als CSS-Textglyphen gepflegt werden. Besser:

- Lucide/Icon-Komponenten fuer interaktive UI
- Inline-SVG nur fuer projektinterne Spezialicons
- Reine CSS-Indikatoren nur, wenn sie ASCII-kompatibel oder eindeutig getestet sind

## Do

- Design Tokens zuerst definieren.
- Light und Dark Mode ueber dieselben semantischen Variablen pflegen.
- Dichte, aber ruhige Panels bauen.
- Accent sparsam fuer Auswahl, Primaeraktion und semantische Markierung nutzen.
- Metadaten, Tags und Statuschips konsequent einsetzen.
- Interne Scrollbereiche fuer lange Listen, Logs und Inspector-Bodies verwenden.

## Don't

- Keine grossen dekorativen Hero-Flaechen in der App.
- Keine verschachtelten Card-Landschaften.
- Keine allzu verspielten Fantasy-Texturen als UI-Basis.
- Keine neuen Farben direkt im Component-CSS, wenn ein Token existieren sollte.
- Keine UI-Indikatoren als kaputte Encoding-Glyphen.
- Keine riesigen Border-Radii fuer Arbeitswerkzeuge.

## Basis-Snippet

Das extrahierte CSS-Fundament liegt hier:

```text
worldbuilding_architecture_study/snippets/bastion-style-foundation.css
```

Es enthaelt Tokens, Typografie, Buttons, Panels, Forms, Tabs, Statuschips, Modals, Toasts, Tabellen, Scrollbars und responsive Grundregeln.
