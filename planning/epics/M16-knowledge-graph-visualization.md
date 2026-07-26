# EPIC-025: Knowledge Graph Visualization

Milestone: **M16 - Knowledge Graph Visualization** (GitHub #19). Area: `area: search`.
Eigenständiger Wissensgraph als **eigener Menüpunkt**. Aus M15 herausgelöst 2026-07-23 —
der Scope ist über die ursprüngliche „gestrichelte Kanten an den Cytoscape-Graphen"-Idee
hinausgewachsen (Custom-Renderer, Galaxy + Ring).

## Goal

Ein globaler, ästhetischer Wissensgraph über die ganze Welt, in zwei Layout-Modi
umschaltbar: **Ring** (geordnete Segmente je Typ — ruhiger Default) und **Galaxy**
(kraftbasierte Cluster je Typ). Beide zeigen **beide** Verbindungsarten visuell getrennt:
deklarierte `relations` **dick/durchgezogen**, `@[Name](id)`-Verlinkungen **dünn/gedämpft**.

## Substrat-Realität (verifiziert — darauf aufbauen bzw. bewusst ablösen)

- **`src/ui/GlobalEntityGraph.tsx`** (Cytoscape `cose`) rendert heute den globalen Relations-Graphen.
  **Wird durch den neuen Custom-Renderer abgelöst** (User-Entscheidung: Custom Canvas statt Cytoscape
  für die Galaxy/Ring-Ästhetik). GlobalEntityGraph darf nach S03/S06 entfernt/ersetzt werden.
- **`src/ui/EntityGraph.tsx`** (Ego-Graph um eine Entity, M2-S13, Cytoscape) — **bleibt unangetastet**,
  außerhalb dieses Epics. Cytoscape-Dependency bleibt deshalb im Projekt.
- **Verlinkungen existieren:** `@[Name](id)`-Mentions in summary/properties, `parseMentions`
  (`PropertiesForm.tsx`), `BacklinksTab.tsx`. `getAllRelations` (`relation-service.ts`) liefert Relations.

## Decisions

- **D1 — Custom Canvas-2D-Renderer, kein Framework.** Konsistent mit Maps/Audio (eigenen Renderer bauen,
  keine UI-Graph-Lib). Der globale Graph läuft auf `<canvas>`, nicht auf Cytoscape.
- **D2 — `d3-force` als reine Daten-/Physik-Lib** (nur für Galaxy-Layout). Kategorie wie `emojibase-data`:
  Daten-/Rechen-Lib ohne DOM/Rendering — erlaubt. Neue Deps: `d3-force` + `@types/d3-force`. Ring braucht
  **keine** Physik (deterministische Radial-Mathematik).
- **D3 — Gruppierung nach Entity-Typ.** Galaxy-Cluster **und** Ring-Segmente gruppieren nach `type`
  (Character/Location/Faction/Event/Lore…). Knotenfarbe = Typ-Farbe (Typ→Farb-Mapping, EPIC-003 wiederverwenden
  falls vorhanden, sonst deterministische Palette).
- **D4 — Zwei Layout-Modi, umschaltbar; Ring = Default.** Ring ist der ruhige, geordnete Standard (für
  2D-Scheue); Galaxy zuschaltbar.
- **D5 — Kanten-Kodierung.** `relation` = **dick** (~2.5px), durchgezogen, deckend. `mention` = **dünn**
  (~1px), gedämpfte Farbe, halbtransparent (~0.35). Verlinkungen sind visuell den Relations untergeordnet.
- **D6 — Knoten-Kodierung.** Kreis, Füllung = Typ-Farbe, **Radius nach Verbindungsanzahl (degree)** (min/max
  geklemmt) — stark vernetzte Knoten groß (die „Zentralsonnen" der Referenzbilder).
- **D7 — Interaktion.** Klick auf Knoten → `onNavigate(entityId)` (Entity öffnen). Hover → Knoten + seine
  Kanten/Nachbarn hervorheben, Rest dimmen. Pan (Hintergrund ziehen) + Zoom (Rad).
  **Wheel-Zoom als nativer `{passive:false}`-Listener** (nicht React-`onWheel` — sonst
  „preventDefault inside passive listener", siehe Maps-#313).
- **D8 — Kanten-Trennung im Datenmodell, Layout ist entkoppelt.** Der Renderer (S03) kennt **kein** Layout —
  er bekommt fertige Positionen. Galaxy (S04) und Ring (S05) sind reine Positions-Rechner. So bleibt jede
  Story isoliert test- und implementierbar.
- **D9 — Relation subsumiert Mention.** Existiert zwischen zwei Knoten bereits eine `relation`, wird eine
  `mention` zwischen demselben (ungeordneten) Paar **verworfen** — die Relation ist das stärkere Signal, keine
  doppelte Linie.

## Datenmodell (gepinnt für S02)

```
GraphNode = { id: string; type: string; label: string; degree: number }
GraphEdge = { source: string; target: string; kind: 'relation' | 'mention' }
GraphModel = { nodes: GraphNode[]; edges: GraphEdge[] }
```

## Stories

| Story | Issue | Kern (ein Verhalten) | hängt an |
|---|---|---|---|
| M16-S01 | #288 | Mention-Kanten-Extraktion (`buildMentionEdges`, reine Fn) — unverändert | — |
| M16-S02 | #317 | Graph-Datenmodell `buildGraphModel` (Knoten+Typ+degree, Relation/Mention-Kanten, D9-Subsumption) | S01 |
| M16-S03 | #289 | Canvas-Render-Grundgerüst + eigener Menüpunkt (zeichnet Knoten/Kanten bei gegebenen Positionen, Pan/Zoom, Klick/Hover) — **kein Layout** | S02 |
| M16-S04 | #318 | Galaxy-Layout (`d3-force`, Cluster nach Typ) → Positionen | S03 |
| M16-S05 | #290 | Ring-Layout (deterministische Radial-Segmente nach Typ) → Positionen | S03 |
| M16-S06 | #319 | Modus-Switcher (Galaxy⇄Ring, Ring=Default) + Verlinkungen-Toggle + Legende | S04+S05 |

**Achse:** S01 → S02 → S03 → (S04, S05) → S06.

## Constraints (verbatim in jede betroffene Story-AC)

- AP-001: `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown`/`as never`.
- AP-006: No `try/catch` around DB operations; errors propagate. (Ausnahme: `JSON.parse`/Mention-Parse → safe fallback.)
- AP-008 (service gate): No `if (database)`/`if (service)` guard before service calls.
- UI-Stories (S03/S06): AP-003 (no `prompt`/`alert`/`confirm`); AP-008 RTL (anchored queries); keine hardcodierten UI-Strings (`useTranslation` + inline German default); ≥1 `.dom.test.tsx`.
- Test files: ESM `import` only, no `require()` (AP-005).

## Out Of Scope

- Ego-Graph (`EntityGraph.tsx`) — bleibt Cytoscape, unangetastet.
- Graph-Analytik (Zentralität, kürzeste Pfade, Community-Detection).
- Editieren von Relations/Mentions aus dem Graphen (nur lesen + navigieren).
- WebGL (Canvas-2D reicht für WorldBuilderX-Größe — Dutzende bis Hunderte Entities).
- Der ultra-polierte Glow-Look 1:1 aus den Referenzbildern — Struktur + Ästhetik ja, aber kein GPU-Shader-Aufwand.

## Sources

- Referenzbilder (Galaxy/Ring/Detail) aus einer Datei-KB-Visualisierung — Inspiration, nicht 1:1.
- Vorhandener Code: `GlobalEntityGraph.tsx`, `EntityGraph.tsx`, `PropertiesForm.tsx` (`parseMentions`), `relation-service.ts`.
- Interview 2026-07-23 (Requirement Agent).
