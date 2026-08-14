# 09 Decision Log And Open Questions

## Current Bias

| Area | Current Recommendation |
|---|---|
| Study type | Feature-/Architekturstudie, kein MVP-Scope |
| Priority | PnP > Game Design, aber beide anschlussfaehig |
| Tech | Tauri v2 Desktop Wrapper mit React/TypeScript Renderer |
| Storage | JSON Ground Truth + SQLite Runtime |
| Search | SQLite FTS5 fuer V1 |
| DB Upgrade | PostgreSQL optional spaeter |
| Entity Model | Entity + Properties + Body Blocks |
| Relations | typed edge table with inverse labels |
| UI Plugins | Hybrid aus JSON Schema + optional UI Schema |
| Conditions | JsonLogic oder CEL |
| Maps | Import/Annotation, kein Mapmaking |
| AI | fuer V1 raus |

## Big Architecture Decisions

### 1. JSON vs Database

Empfehlung:

- JSON ist Export/Import/Ground Truth.
- SQLite ist Runtime und Index.

Warum:

- JSON only ist zu schwach fuer Suche/Relations.
- DB only erzeugt Lock-in.
- Hybrid gibt Freiheit und Performance.

Offen:

- Wird jeder Save direkt in JSON geschrieben oder gibt es explizite Export-Snapshots?

### 2. SQLite vs PostgreSQL

Empfehlung:

- SQLite fuer V1.
- PostgreSQL als spaeterer Team-/Poweruser-Modus.

Warum:

- lokale Offline-App profitiert von null Setup.
- SQLite FTS5 reicht fuer lokale Projekte wahrscheinlich.
- Postgres ist staerker, aber Setup-Aufwand ist fuer ein PnP-Tool Gift.

Offen:

- Soll die Architektur SQL-dialektneutral bleiben?

### 3. Entity Types

Empfehlung:

- kleine Core-Liste
- Plugin-Erweiterung

Core:

- Character
- Location
- Faction
- Item
- Event
- Quest
- Scene
- Rule
- Resource

Offen:

- Sind Culture und Organization eigene Core Types oder Varianten?

### 4. Relations

Empfehlung:

- eine Relation = eine Edge
- inverse Label aus Relation Type Registry
- keine doppelte Speicherung

Offen:

- Sollen Relations selbst Body/Notes haben?
- Brauchen Relations Visibility und Time Ranges? Vermutlich ja.

### 5. Calendar Depth

Empfehlung:

- absolute interne Timeline
- Kalender als Projektion
- Wizard + Presets

Offen:

- Genauigkeit: Tag oder Minute?
- V1 State-at-Time voll implementieren oder nur vorbereiten?

### 6. Session Conditions

Empfehlung:

- Conditions als gespeicherte Daten
- UI Builder fuer normale Nutzer
- JsonLogic/CEL intern

Offen:

- JsonLogic ist JSON-nativer.
- CEL ist lesbarer.
- Stackentscheidung beeinflusst Wahl.

### 7. UI Plugin Architecture

Empfehlung:

- JSON Schema Pflicht
- UI Schema optional
- Custom Renderer nur aus Core Registry

Offen:

- Welche Renderer sind Core?
- Wie strikt validiert die App Plugins?

### 8. Cards

Empfehlung:

- Card ist Projektion, nicht Wahrheit.
- Core Entity bleibt vollstaendig.
- Card Summary explizit pflegen.

Offen:

- Wird Card Summary manuell gepflegt oder spaeter assistiert?

## Suggested Phase Split

### Phase 0: Architecture Prototype

- JSON schemas fuer Entity, Relation, MapMarker, Session
- SQLite import
- FTS5 index
- einfache Table View
- einfache Entity Page

### Phase 1: PnP Core

- Session Pages
- Visibility Conditions
- Capture Inbox
- Map Import + Pins
- Relation Browser

### Phase 2: Power Views

- Timeline
- Graph View
- Board View
- Saved Views
- Card/Handout templates

### Phase 3: Rulesets

- Ruleset Plugin API
- DnD example plugin
- DM Screen dashboards
- Encounter/Quest warnings

### Phase 4: Desktop Packaging

- Tauri v2 wrapper
- project folder management
- backups
- plugin folder loading

## Highest-Risk Areas

| Risk | Warum kritisch | Gegenmittel |
|---|---|---|
| zu flexible UI | Plugin-System wird unwartbar | Hybrid + Renderer Registry |
| schlechte Suche | Tool stirbt im Alltag | FTS5 ab Tag 1 |
| zu viel VTT | Scope explodiert | nur Annotation/State, kein Foundry-Klon |
| Calendar Overengineering | Nutzer steigen aus | Presets + Wizard |
| Karten als Sonderwelt | Lore dupliziert sich | Marker referenzieren Entities |
| AI zu frueh | Ground Truth verschmutzt | AI spaeter nur assistierend |

## Next Concrete Spec Questions

Wenn daraus spaeter ein echtes MVP werden soll, waeren die naechsten Fragen:

1. Welche Core Entity Types sind fuer V1 wirklich Pflicht?
2. Soll der Texteditor Markdown-first oder Block-JSON-first sein?
3. Welche Condition Engine wird genommen?
4. Muss PDF/Card Export in V1 rein oder Phase 2?
5. Wie sieht ein minimaler Plugin-Ordner aus?
6. Wie wird JSON Export strukturiert: ein File oder viele Files?
7. Braucht V1 Undo/History?
8. Soll es Git-kompatible Projektordner geben?
9. Welche UI-Technologie wird als Referenz angenommen?
10. Welche DnD-Daten duerfen legal importiert werden?

Diese Fragen wurden in `10_MVP_Spec_Decisions.md` beantwortet.

Kurzfassung:

| Frage | Entscheidung |
|---|---|
| Core Entity Types | Character, Location, Faction, Item, Event, Quest, Scene, Rule, Resource, Culture |
| Editor | Block-JSON als Storage, Markdown-first Editor-UX |
| Conditions | JsonLogic + visueller Condition Builder |
| Cards/PDF | V1 Pflicht: JSON Templates, A4 3x3, PDF, PNG, Poker/Tarot/A4/Moderationskarte |
| Plugins | Ordnerbasiert, `plugin.json` Pflicht, optionale Unterordner fuer Types/Views/Cards/Rules/Assets |
| JSON Export | Viele JSON-Dateien im Projektordner, ZIP Import/Export ab V1 |
| Undo/History | Editor-Undo wenn Standard, Session-Undo fuer GM-Missklicks, keine volle Entity-History |
| Git | Git-kompatible Projektordner sind explizites V1-Ziel |
| UI Tech | React + TypeScript Renderer im Tauri v2 Desktop Wrapper |
| DnD Daten | User-Homebrew + klar lizenzierte SRD-Basisdaten; Source-/Lizenz-Metadaten pro Rule Entity |

## Recommended Next Step

Als naechstes sollte ein kleines technisches Proof-of-Concept spezifiziert werden:

```text
Project folder
  entities/*.json
  entity_types/*.json
  relations/*.json
  maps/*.json
  sessions/*.json
  plugins/*.json

Local app
  Import JSON
  Validate
  Build SQLite
  FTS search
  Show Entity Page
  Show Table View
  Show Map with one image and pins
```

Das prueft die wichtigsten Architekturannahmen ohne direkt in VTT, AI oder Card-Designer zu versinken.
