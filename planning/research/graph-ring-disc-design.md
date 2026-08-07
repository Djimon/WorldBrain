# Ring/Disc-Modus — Design (M16-S05 / #290)

Ergebnis der Grilling-Session (2026-08-07). Ersetzt den alten Platzhalter-Stand
im Issue (simple Radial-nach-Typ). Referenzbild: `_design/knowledgegraph-ring-view.png`.

## Kernidee

Der Ring/Disc-Modus ist **kein** eigener Graph und **keine** Draufsicht der
Galaxy. Er ist derselbe `GraphCanvas` (D12) mit einer anderen Layout-Prop: fixe
2D-Positionen (`z=0`), Force aus. Er hat eine **eigene Verteilung**, damit die
Scheibe strukturiert lesbar wird.

## Layout-Regeln

1. **Areas = Entity-Typ.** Ein harter Keil (Kreissektor) je vorkommendem Typ.
2. **Sektor-Winkel proportional zur Knotenzahl** des Typs (Summe 360°). Doppelt
   so viele Knoten -> doppelt so breiter Keil.
3. **Sektor-Reihenfolge nach Berührung.** type×type Berührungs-Matrix (Anzahl
   Kanten zwischen zwei Typen). Seriation ordnet die Keile so, dass stark
   verbundene Typen benachbart liegen. Greedy Nearest-Neighbour ab einem
   deterministischen Start (höchste Gesamt-Berührung, Tie-break Typ-Name).
4. **Innerhalb eines Keils: force-basierte Sub-Gruppierung.** Deterministische
   2D-Force (seeded, feste Ticks, `.stop()`) mit Repulsion + Anziehung entlang
   der **intra-typ** Kanten -> verbundene Knoten klumpen sinnvoll. Nach jedem
   Tick harte Projektion in [Sektor-Winkel] × [rInner, rOuter] (harte Keile,
   gefüllte Scheibe, maximierte Abstände).
5. **Kein Radius-Signal.** Radius ist emergent, **nicht** nach `degree` (kein
   fixer "vernetzteste innen"-Kern). Grund: Stabilität + der Kern war nur Deko
   im Referenzbild.
6. **Einmal berechnet, eingefroren** als `fx/fy`. Filter/Settings blenden danach
   nur aus -> Positionen springen **nie**. (Nur Kugel-*größe* skaliert live nach
   sichtbaren Kanten, wie im Galaxy-Modus — Position nie.)

Determinismus: seeded Initialpositionen (mulberry32) + feste Tickzahl + `.stop()`,
plus stabile `id`-Sortierung bei Gleichstand. Zweimal gerechnet -> identisch.

## Rendering / Wiring (Teil dieser Story)

- `GraphCanvas`-Prop `layout.mode: 'galaxy' | 'ring'` + `positions` (Ring: z=0).
- **Switch-Button oben rechts**, Label "Galaxy / Disc", Zustand in
  `graph-settings` persistiert, Default **Galaxy** (Start-Default laut Epic).
- **Ring-Kamera:** top-down (Blick senkrecht auf die x-y-Scheibe = Default-Front),
  Kippen gesperrt (OrbitControls-Rotation aus), Zoom/Pan frei, **Drag dreht die
  Scheibe in ihrer Ebene** (Roll um die Welt-Z-Achse über eine Content-Group).
  Galaxy-Orbit beim Zurückschalten wiederhergestellt.
- **Ego-Tab bleibt immer Galaxy** (Ring bei einer einzigen Area sinnlos).

## Out of scope -> Folge-Issue "M16: Ring-Chrome" (`idea`)

Rein visuelle Deko, keine Layout-Änderung:
- Typ-Labels am Rand je Area (Überschneidung mit Legende #319 vermerken).
- Konzentrische Hilfskreise + Außenring.
- **Kein** Kern-Glow (war nur im Referenzbild, wird nicht gebraucht).

## Housekeeping

#319 war "Switcher/Default/Legende". Da der Switch hier gebaut wird, schrumpft
#319 auf Default-Wahl-Politik + Legende.

## Test-Matrix (`tests/m16-s05-ring-layout.test.ts`, reine Layout-Logik)

- Sektor-Winkel proportional zur Typ-Knotenzahl (doppelt so viele -> doppelt so breit).
- Alle Knoten eines Typs liegen in ihrem Winkelbereich (harte Keile).
- Seriation: Typen mit vielen Berührungen sind benachbart.
- Determinismus: zweimal -> identische Positionen.
- Ring-Modus setzt fixe Positionen; keine Live-Sim verschiebt Knoten.

(Der alte "höherer degree => kleinerer Radius"-Test entfällt — keine
degree-Radial-Achse mehr.)
