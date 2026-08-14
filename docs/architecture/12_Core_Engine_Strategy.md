# 12 Core Engine Strategy

Dieses Dokument ist keine fertige Spec. Es beschreibt eine Strategie, wie generische Core-Engines entworfen werden koennen, ohne dass das System durch zu viel Abstraktion unwartbar wird.

Ausgangspunkt ist die Frage:

> Wie kann ein Plugin komplexe Features wie Bastions, Rulesets, Session Workflows oder Economy-Systeme ausdruecken, ohne dass jedes Plugin eigenen Code ausfuehren muss?

## Core Tension

Das Ziel ist eine Plattform, die mehr kann als statische Daten anzeigen.

Aber:

- reine JSON-Plugins koennen keine neue Logik ausfuehren
- freies Plugin-JavaScript macht Sicherheit, Versionierung und Debugging schwer
- zu generische Engines werden schnell unlesbar
- zu spezifische Engines blockieren spaetere Features

Die Loesung liegt nicht in einer einzelnen "Super Engine", sondern in kleinen, stabilen Core-Services, die zusammengesetzt werden koennen.

```text
Plugin JSON
  -> Core Services
  -> Workflow Runtime
  -> UI Projection
  -> Session/Project State
```

## Strategy

Core-Engines sollten wie Mini-Services gedacht werden.

Jeder Service hat:

- eine klare Aufgabe
- ein kleines Input-/Output-Modell
- deterministisches Verhalten
- gute Validierung
- keine versteckten Seiteneffekte ausserhalb seines Zustandsbereichs
- eine explizite Version

Komplexe Features entstehen dann aus Service-Kombinationen.

Beispiel Bastion:

```text
Entity Service
+ Resource/Ledger Service
+ Turn/Clock Service
+ Dice Service
+ Workflow Service
+ Effect Service
+ Formula Service
+ Event Table Service
+ Dashboard Renderer
= Bastion System
```

Das Bastion-Plugin definiert Daten und Regeln. Der Core stellt die ausfuehrbaren Bausteine.

## Non-Goal

Der Core soll nicht versuchen, jede denkbare Spielmechanik perfekt nativ abzubilden.

Nicht Ziel:

- beliebige Programmiersprache in Plugins
- universelle Simulationsplattform
- visuelle Programmiersprache fuer alles
- Turing-vollstaendige Rule Engine
- frei verschachtelte Meta-Engines

Ziel:

- 80 Prozent komplexer PnP-/Worldbuilding-Workflows deklarativ abbilden
- harte Sonderfaelle spaeter bewusst ueber registrierte Erweiterungspunkte behandeln
- Core klein genug halten, dass Fehler nachvollziehbar bleiben

## Engine Layers

### 1. Data Layer

Speichert und validiert die statischen Definitionen.

Beispiele:

- Entity Types
- Relation Types
- Facility Types
- Rule Types
- Card Templates
- Event Tables
- Workflow Definitions

Technologie:

- JSON files
- JSON Schema
- Plugin Manifest
- SQLite Runtime Cache

### 2. State Layer

Haelt veraenderlichen Zustand.

Beispiele:

- Session Variables
- Inventory
- Currency
- Built Facilities
- Active Orders
- Timers
- Revealed Flags
- NPC Assignment

Wichtig:

- State muss klar vom Definition Catalog getrennt bleiben.
- Definitionen kommen aus Plugins/Core.
- State gehoert zum Projekt oder zur Session.

### 3. Evaluation Layer

Berechnet Entscheidungen, ohne direkt UI zu sein.

Beispiele:

- JsonLogic Conditions
- Dice Checks
- Formula Evaluation
- Outcome Selection
- Effect Resolution
- Event Table Rolls

Diese Services sollten einzeln testbar sein.

### 4. Workflow Layer

Ordnet einzelne Aktionen in Ablaufmodelle.

Beispiele:

- build -> wait -> complete
- assign NPC -> start order -> advance turns -> roll -> resolve
- discover clue -> reveal handout -> update quest state
- start timer -> trigger condition -> show marker

Wichtig:

- Workflow Engine darf nicht selbst alles wissen.
- Sie orchestriert Services.
- Domain-Regeln kommen aus Definitionen und registrierten Capabilities.

### 5. Projection Layer

Macht aus Daten und State sichtbare UI-/Export-Modelle.

Beispiele:

- Entity Page
- Table View
- Player View
- Card Export
- Session Dashboard
- Bastion Console
- Rule Reference Panel

Projection soll keine eigene Wahrheit erzeugen.

## Candidate Core Services

| Service | Aufgabe | Wiederverwendung |
|---|---|---|
| Entity Service | CRUD, IDs, Types, Properties | alle Features |
| Relation Service | typed edges, inverse labels | Graph, Quests, Maps, Rules |
| Visibility Service | Context + Conditions -> sichtbar? | Player View, Maps, Cards, Sessions |
| Condition Service | JsonLogic validieren/auswerten | Visibility, Triggers, Workflows |
| Variable Service | globale/sessionbezogene Variablen | Sessions, Rules, Workflows |
| Dice Service | Rolls, Check Profiles, Result Buckets | Rules, Bastions, Encounters |
| Formula Service | sichere Berechnungen | Economy, Cards, Balance, Bastions |
| Ledger Service | Currency/Items/Stats veraendern | Bastions, Shops, Rewards |
| Effect Service | Effects validieren/ausfuehren | Orders, Events, Sessions |
| Event Table Service | gewichtete/random Events | Bastions, Travel, Encounters |
| Timer/Clock Service | Turn, Round, Countdown, World Time | Sessions, Bastions, Maps |
| Workflow Service | Action-State-Machines | Bastions, Quests, Downtime |
| Audit Service | Actions protokollieren | Session Undo, Debugging |
| Projection Service | Daten fuer Views vorbereiten | UI, Export, Player View |

## Required Extension Points

Ein generischer Core-Service ist nur dann wirklich nuetzlich, wenn Features sich kontrolliert daran registrieren koennen.

Der wichtigste Grundsatz:

> Ein Feature darf nicht seinen eigenen parallelen Loop, sein eigenes Ledger oder seine eigene Event-Pipeline bauen, wenn es dafuer bereits einen Core-Service gibt.

Stattdessen melden Features ihre Definitionen beim passenden Service an.

### Turn / Clock Engine

Die Turn Engine ist ein zentraler Loop fuer alles, was regelmaessig fortschreitet.

Beispiele:

- Bastion Orders
- Travel Progress
- Faction Clocks
- Downtime Activities
- Timers / Countdowns
- Ongoing Rituals
- Market Refresh
- World Events

Ein Feature registriert keine eigene Schleife, sondern einen Turn Handler:

```json
{
  "turn_handlers": [
    {
      "id": "bastion.advance_orders",
      "phase": "session_turn_end",
      "target": "active_orders",
      "action": "increment_progress"
    }
  ]
}
```

Moegliche Phasen:

```text
before_turn_start
turn_start
turn_end
after_turn_end
round_start
round_end
world_day_start
world_day_end
```

Wichtig:

- Handler laufen in definierter Reihenfolge.
- Handler duerfen nur ueber erlaubte Effects State veraendern.
- Jeder Handler erzeugt Audit-Eintraege.
- Fehler in einem Handler duerfen nicht den kompletten Loop unkontrolliert zerlegen.

### Ledger / Resource Registry

Der Ledger ist der zentrale Ort fuer Ressourcen, Inventar, Currency und custom Stats.

Jedes Feature kann eigene Ressourcen registrieren:

```json
{
  "resources": [
    {
      "id": "bastion.heat",
      "label": "Heat",
      "type": "number",
      "scope": "project",
      "min": -10,
      "max": 10,
      "default": 0
    },
    {
      "id": "faction.influence",
      "label": "Influence",
      "type": "number",
      "scope": "entity",
      "entity_types": ["faction"],
      "default": 0
    }
  ]
}
```

Resource Scopes:

| Scope | Bedeutung |
|---|---|
| project | gilt fuer das ganze Projekt |
| session | gilt nur fuer eine Session |
| entity | gehoert zu einer Entity |
| party | gehoert zu einer Party/Spielergruppe |
| plugin | gehoert zu einem Plugin-System |

Der Ledger sollte mindestens koennen:

- add
- subtract
- set
- clamp min/max
- validate resource type
- format/display
- audit changes

Damit koennen Bastions, Shops, Reputation, Faction Clocks, Quest Progress und Encounter Resources dieselbe Infrastruktur nutzen.

### Effect Registry

Effects sind die gemeinsame Sprache fuer State-Aenderungen.

Ein Feature sollte nicht direkt fremden State mutieren. Es erzeugt Effects, die der Core validiert und ausfuehrt.

Beispiele:

```text
add_resource
remove_resource
set_resource
add_item
remove_item
set_variable
increment_variable
append_log
trigger_event
start_timer
advance_timer
reveal_content
hide_content
create_entity
link_relation
```

Plugin-Definitionen duerfen nur bekannte Effect Types verwenden.

Spezialeffekte koennen spaeter ueber registrierte Core Capabilities dazukommen, aber nicht als beliebiges Plugin-Script.

### Event Bus

Neben Turn Handlern braucht es einen zentralen Event Bus fuer diskrete Ereignisse.

Beispiele:

```text
entity.created
entity.updated
relation.created
session.started
session.ended
turn.advanced
order.completed
resource.changed
visibility.revealed
map.marker.revealed
card.exported
```

Features koennen darauf reagieren:

```json
{
  "event_handlers": [
    {
      "id": "quest.warn_blocked",
      "on": "relation.updated",
      "condition": {
        "==": [{ "var": "relation.type" }, "requires_clue"]
      },
      "effects": [
        { "append_log": "Quest dependency changed." }
      ]
    }
  ]
}
```

Guardrail:

- Event Handler sollten klein bleiben.
- Keine endlosen Event-Ketten.
- Max Depth / Cycle Detection ist Pflicht.
- Alle Handler muessen auditierbar sein.

### Workflow Registry

Workflows beschreiben mehrstufige Prozesse.

Beispiele:

- Bastion build lifecycle
- Facility order lifecycle
- Quest objective lifecycle
- Downtime activity
- Research project
- Crafting project

Ein Workflow besteht aus:

- states
- actions
- guards
- effects
- timers/turn hooks

Beispiel grob:

```json
{
  "workflow_type": "bastion.order",
  "states": ["idle", "in_progress", "ready", "resolved"],
  "actions": [
    {
      "id": "start",
      "from": "idle",
      "to": "in_progress",
      "guards": ["has_assigned_npc", "facility_free"],
      "effects": ["append_log"]
    },
    {
      "id": "advance_turn",
      "from": "in_progress",
      "to": "ready",
      "condition": "progress >= duration"
    },
    {
      "id": "resolve",
      "from": "ready",
      "to": "resolved",
      "effects": ["apply_outcome"]
    }
  ]
}
```

Die Workflow Engine sollte generisch sein, aber nicht versuchen, alle Domain-Regeln selbst zu kennen.

### Projection / Dashboard Registry

Wenn Features Core-Services nutzen, brauchen sie auch eine kontrollierte Art, UI daraus zu bauen.

Ein Feature kann Views/Dashboards registrieren:

```json
{
  "dashboards": [
    {
      "id": "bastion.console",
      "renderer": "core.workflow_dashboard",
      "source": {
        "workflow_types": ["bastion.order"],
        "resources": ["bastion.heat", "treasury", "inventory"]
      }
    }
  ]
}
```

Das ist der Ersatz fuer "Plugin liefert komplette eigene UI".

Der Core stellt flexible Renderer bereit. Das Plugin liefert Layout, Quellen und Aktionen.

## Extension Point Rule

Jeder zentrale Service braucht zwei APIs:

```text
definition API:
  Was kann ein Plugin anmelden?

runtime API:
  Was darf zur Laufzeit passieren?
```

Beispiel Ledger:

```text
definition:
  register resource type
  register currency
  register stat

runtime:
  apply effect
  get value
  format value
  audit mutation
```

Beispiel Turn Engine:

```text
definition:
  register handler
  register phase
  declare ordering/dependencies

runtime:
  advance turn
  execute handlers
  collect effects
  audit result
```

Das verhindert, dass Features dieselbe Infrastruktur mehrfach nachbauen.

## Composition Instead Of Inheritance

Ein Plugin sollte nicht sagen:

```text
Ich bin ein BastionPlugin mit Spezialcode.
```

Sondern:

```json
{
  "requires": [
    "core.entity",
    "core.workflow",
    "core.ledger",
    "core.dice",
    "core.formula",
    "core.event_table"
  ]
}
```

Dann definiert es:

- welche Entity Types existieren
- welche Workflow Types gebraucht werden
- welche Actions moeglich sind
- welche Effects ausgefuehrt werden
- welche Dashboards angezeigt werden

So bleibt das Feature deklarativ, aber nicht trivial.

## Capability Registry

Plugins sollten nur Features nutzen duerfen, die der Core explizit anbietet.

Beispiel:

```json
{
  "required_capabilities": {
    "core.workflow": ">=1.0.0 <2.0.0",
    "core.ledger": ">=1.0.0 <2.0.0",
    "core.formula": ">=1.0.0 <2.0.0"
  }
}
```

Vorteile:

- Import kann frueh scheitern oder warnen
- Plugin-Kompatibilitaet ist pruefbar
- Core-Services koennen versioniert werden
- keine versteckten Annahmen

## Plugin Power Levels

Es hilft, Plugin-Macht bewusst in Stufen zu denken.

| Level | Beschreibung | Beispiel | V1-tauglich |
|---|---|---|---|
| 0 | Datenkatalog | Items, Locations, Rules | ja |
| 1 | Schema/UI | neue Entity Types, Forms, Views | ja |
| 2 | Declarative Logic | Conditions, formulas, effects | ja, vorsichtig |
| 3 | Workflow Composition | Orders, turns, state machines | spaeter/PoC |
| 4 | Registered Core Renderer | Bastion Console, Timeline Editor | ja, wenn Core-owned |
| 5 | Plugin Code | eigenes JS/WASM/Python | nicht V1 |

Strategie:

- V1 zielt auf Level 0-2.
- Architektur sollte Level 3 vorbereiten.
- Level 4 nur ueber Core-Registry, nicht beliebig.
- Level 5 erst nach klarer Sicherheits- und API-Strategie.

## Design Guardrails

### Keep Services Boring

Ein Core-Service soll langweilig und vorhersehbar sein.

Gut:

- `apply_effects(effects, state, context)`
- `evaluate_condition(condition, context)`
- `roll_check(profile, modifiers)`
- `advance_workflow(workflow_id, action, state)`

Schlecht:

- ein Service, der gleichzeitig UI rendert, State veraendert, Events rollt und History schreibt

### Prefer Declarative Verbs

Effects und Actions sollten aus einer kleinen Verb-Menge bestehen.

Beispiele:

```text
add_currency
remove_currency
add_item
remove_item
set_variable
increment_variable
append_log
trigger_event
start_timer
advance_timer
set_visibility_flag
```

Shorthands sind fuer UX okay, aber intern sollte alles normalisiert werden.

### Normalize Before Execute

Plugin-Definitionen sollten nicht direkt ausgefuehrt werden.

Pipeline:

```text
load JSON
validate schema
normalize
resolve references
build runtime plan
execute runtime plan
log result
```

Das reduziert Sonderfaelle im eigentlichen Runtime-Code.

### Small DSLs Beat Big DSLs

JsonLogic fuer Conditions.

Formula Engine fuer kleine sichere Rechnungen.

Workflow Definition fuer Zustandsuebergaenge.

Nicht alles in eine Mega-DSL pressen.

## Example: Bastion As Composition

Ein Bastion-Plugin koennte spaeter so gedacht werden:

```text
Entity Types:
  bastion
  bastion_facility
  bastion_order
  bastion_npc_role

State:
  built_facilities
  active_orders
  treasury
  inventory
  bastion_stats
  current_turn

Services:
  workflow
  ledger
  dice
  formula
  event_table
  audit

Renderer:
  core.dashboard_renderer
  core.workflow_console
```

Die Kernfrage ist dann nicht:

> Darf das Plugin JS?

Sondern:

> Haben wir die noetigen generischen Services, um dieses System deklarativ zu beschreiben?

## When JSON Is Enough

JSON reicht, wenn ein Feature ausdrueckbar ist als:

- Daten
- Properties
- Relations
- Views
- Conditions
- Effects
- Formeln
- bekannte Workflow-Schritte
- bekannte Renderer

Beispiele:

- Bastion Facilities
- Downtime Activities
- Travel Events
- Shops
- Faction Clocks
- Reputation Systems
- Encounter Risk Tables
- Rule Reference Dashboards

## When JSON Is Not Enough

JSON reicht nicht, wenn ein Feature braucht:

- komplett neue Algorithmen
- neue Optimierungslogik
- stark interaktive Spezial-UI
- komplexe Simulation
- externe APIs
- eigene Importparser
- eigene Persistenzlogik
- langlaufende Hintergrundprozesse

Dafuer gibt es spaeter drei bessere Eskalationsstufen als sofort freies JS:

1. neuen Core-Service bauen
2. neuen Core-Renderer registrieren
3. kontrollierte Plugin-Code-Schnittstelle entwerfen

## JS Support Later

Plugin-JS sollte nicht kategorisch ausgeschlossen werden, aber spaeter bewusst kommen.

Moegliche sichere Varianten:

- nur signed/trusted plugins
- nur sandboxed JS worker ohne DOM/File-System
- nur pure functions mit begrenztem Input/Output
- optional WASM fuer deterministische Berechnungen
- separate "developer mode" Installation

Bevor das sinnvoll ist, braucht es:

- stabile Plugin API
- Permissions-Modell
- Versionsmodell
- Crash-Isolation
- Debugging-Konzept
- Security Review

## Recommended Approach

Fuer die naechste Architekturphase:

1. Core-Services identifizieren, die mehr als ein Feature brauchen.
2. Jeden Service klein und separat spezifizieren.
3. Pro Service ein minimales Input/Output-Modell definieren.
4. Einen komplexen Referenzfall nehmen, z.B. Bastion.
5. Pruefen, welche Teile mit vorhandenen Services gehen.
6. Nur fehlende generische Services ergaenzen.
7. Keine Bastion-Speziallogik in den Core schreiben, solange sie als Workflow/Ledger/Formula/Event-Kombination modellierbar ist.

## Strategic Rule

Ein Service darf in den Core, wenn mindestens zwei unterschiedliche Feature-Familien ihn sinnvoll brauchen.

Beispiele:

| Service | Feature 1 | Feature 2 | Core-wuerdig |
|---|---|---|---|
| Ledger | Bastions | Shops/Rewards | ja |
| Dice | Rules | Bastions/Encounters | ja |
| Formula | Economy | Balance/Cards | ja |
| Event Table | Travel | Bastions/Encounters | ja |
| Workflow | Bastions | Quests/Downtime | ja, vorsichtig |
| Bastion-specific UI | Bastions | keine zweite Familie | nur Renderer/Plugin, nicht allgemeiner Core |

## Summary

Die Meisterdisziplin ist nicht maximale Abstraktion.

Die Meisterdisziplin ist:

- kleine Services
- klare Grenzen
- sichere deklarative Bausteine
- konsequente Komposition
- Core nur dort erweitern, wo mehrere Feature-Familien profitieren

So kann ein Plugin spaeter sehr maechtig werden, ohne dass der Core zu einer unkontrollierbaren Superplattform wird.
