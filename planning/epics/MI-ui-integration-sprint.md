# EPIC-015: UI Integration Sprint

## Goal

Die App zeigt echte Daten statt Platzhalter. Alle Services sind bereits implementiert und intern
in den Komponenten verdrahtet. Das fehlende Glied ist der App-Shell-Layer: keine DB-Instanz,
kein App-State, kein Routing, kein Database-Context. Dieser Epic schließt genau diese Lücke —
Milestone für Milestone.

## Diagnose

`App.tsx` ist reiner M0-Placeholder (3 statische Tabs, Placeholder-Text). Alle ~30 UI-Komponenten
und ~40 Services existieren, werden aber nie gemountet oder aufgerufen. Die Komponenten sind intern
gut verdrahtet (z.B. `GlobalSearch` ruft `searchEntities`, `NewProjectDialog` ruft `createProject`).
Das Problem ist ausschließlich die fehlende Verbindung vom App-Shell nach unten.

## Decisions

1. **Database Context:** `DatabaseLike`-Instanz wird via React Context bereitgestellt. Kein Prop-Drilling durch die gesamte Komponentenbaum.
2. **App-State:** Zentraler `AppState` in `App.tsx`: `{ mode: 'welcome' | 'workspace', projectId: string | null, db: DatabaseLike | null }`.
3. **Routing:** Kein React Router — einfaches State-basiertes Routing. `mode === 'welcome'` → WelcomeScreen. `mode === 'workspace'` → Workspace-Shell.
4. **DB-Initialisierung:** Beim Öffnen eines Projekts wird die SQLite-DB initialisiert und der Base-JSON-Import ausgeführt. DB-Instanz landet im Context.
5. **Navigation im Workspace:** Linke Sidebar mit Bereich-Icons (Entities, Search, Maps, Calendar, Cards, Plugins, Rules, Session, Settings). Kein Framework — einfaches `activeArea`-State.

## Out of Scope

- Vollständiges Redesign der UI-Komponenten
- Neue Features (nur Wiring existierender Komponenten)
- M8/M9 Komponenten (die existieren noch nicht)

---

## Stories

### MI-S01: App Shell — Projekt-Lifecycle & Routing

**Ziel:** `App.tsx` liest App-Config, entscheidet ob WelcomeScreen oder Workspace, und initialisiert die DB.

**AC:**
- Beim Start: `readAppConfig()` → wenn `last_opened_project_id` existiert und gültig ist → direkt Workspace öffnen
- Wenn keine Projekte oder `last_opened_project_id` ungültig → `WelcomeScreen` rendern
- `WelcomeScreen.onCreateProject` → `NewProjectDialog` öffnen → `createProject()` → Projekt in AppConfig registrieren → Workspace öffnen
- `WelcomeScreen.onImportZip` → `ZipImportDialog` öffnen → nach Import → Workspace öffnen
- `WelcomeScreen.onOpenProject(id)` → Projekt laden → Workspace öffnen
- Workspace öffnen = DB initialisieren (SQLite via `importBaseJsonProject`) + AppState auf `{ mode: 'workspace', projectId, db }` setzen
- DB-Instanz wird via React Context bereitgestellt (`DatabaseContext`)
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### MI-S02: Database Context & Workspace-Shell

**Ziel:** Workspace-Shell mit Sidebar-Navigation, DatabaseContext für alle Kindkomponenten.

**AC:**
- `DatabaseContext` exportiert `useDatabase(): DatabaseLike` — wirft wenn kein Context vorhanden
- Workspace-Shell: linke Sidebar mit Navigations-Icons für Bereiche: Entities, Search, Maps, Calendar, Cards, Plugins, Rules, Session, Project
- Aktiver Bereich wird als `activeArea`-State gehalten, entsprechende Komponente wird gemountet
- Kein aktiver Bereich → Entity-Workspace als Default
- Sidebar-Icons haben `data-area`-Attribut für Tests
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### MI-S03: M1–M2 Entity-Workspace verdrahten

**Ziel:** Entities können angelegt, gesucht, geöffnet und bearbeitet werden.

**AC:**
- Entity-Workspace mountet `EntityMasterDetail` mit `database` aus Context
- Entity-Typ-Auswahl in der Sidebar (Character, Location, Faction, Item, Quest, Event, Scene, Rule, Resource, Culture)
- `EntityMasterDetail` zeigt echte Entities aus DB via `listEntitiesByType()`
- Klick auf Entity → `EntityDetailView` öffnet mit `entityId` und `database`
- `EntityDetailView` lädt Entity via `getEntity()` und zeigt `BodyEditor` + `PropertiesForm` + Tabs
- `BodyEditor` speichert Änderungen via `updateEntity()` — Debounce 500ms
- `PropertiesForm` speichert Felder via `updateEntity()` bei onChange
- `RelationsTab` zeigt Relationen via `listRelations()`, neue Relation via `createRelation()`
- Neue Entity anlegen: Button → Dialog → `createEntity()` → erscheint in Liste
- Entity löschen: Button mit Bestätigung → `deleteEntity()`
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### MI-S04: M3 Suche verdrahten

**Ziel:** Globale Suche findet Entities und navigiert zu ihnen.

**AC:**
- `GlobalSearch` mountet im Search-Bereich der Workspace-Shell mit `database` aus Context
- Tastenkürzel `Ctrl+K` / `Cmd+K` öffnet GlobalSearch (Focus auf Eingabefeld)
- `GlobalSearch.onNavigate(entityId)` → wechselt zu Entity-Workspace und öffnet Entity
- Such-Ergebnisse kommen aus `searchEntities()` mit echter DB
- Facetten (Entity-Typ-Filter) kommen aus `getSearchFacets()`
- Gespeicherte Views aus `listSavedViews()` werden als Schnellzugriff angezeigt
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### MI-S05: M4 Session-Modus verdrahten

**Ziel:** Session-Modus-Toggle schaltet in den Session-Bereich, Session-Komponenten arbeiten mit echter DB.

**AC:**
- Session-Bereich in der Workspace-Sidebar öffnet Session-Panel
- `ConditionBuilder` erhält `database` aus Context, speichert Conditions via `updateEntity()`
- `CaptureInbox` arbeitet mit `capture-service`: `addCaptureNote()` / `listCaptureNotes()` mit echter DB
- `PlayerScreen` rendert Session-Pages via `visibility-service` mit echtem Condition-Ergebnis
- Session-Variablen: `session-variable-service` erhält feste `sessionId` aus App-State (aktuelle Session = Projekt-ID als Fallback bis M8)
- `session-undo-service` ist über Undo-Button erreichbar (Shortcut `Ctrl+Z` im Session-Modus)
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### MI-S06: M5 Kalender & Zeit verdrahten

**Ziel:** Kalender, Chronicle, Timeline und Session-Zeit-Komponenten zeigen echte Daten.

**AC:**
- Calendar-Bereich mountet: `CalendarWizard` (Kalender konfigurieren) + `ChronicleView` + `CalendarMonthView` + `EntityTimeline`
- `CalendarWizard` speichert Kalender via `calendar-service` mit `database` aus Context
- `ChronicleView` lädt Events via `listEvents()` mit echter DB
- `CalendarMonthView` lädt Events des aktiven Monats via `listEvents()` gefiltert
- `EntityTimeline` lädt Events für eine Entity via `listEvents({ participantId })`
- `SessionClock` und `EncounterCounters` sind im Session-Bereich verfügbar, `database` aus Context
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### MI-S07: M5 Maps verdrahten

**Ziel:** Karten werden aus der DB geladen, Marker gesetzt und angezeigt.

**AC:**
- Maps-Bereich zeigt Liste aller Karten via `listMaps()` mit `database` aus Context
- Klick auf Karte → `MapViewer` mit `mapId` und `database`
- `MapViewer` lädt Kartenasset via `getAssetUrl()` und rendert auf Canvas
- `MapMarkers` lädt Marker via `map-marker-service.listMarkers()`, zeigt sie auf Canvas
- `SessionGridTracker` erhält `sessionId` aus App-State, `database` aus Context
- Marker-Sichtbarkeit via `map-marker-visibility.isVisible()` mit Condition-Evaluierung
- Karte importieren: Button → File-Dialog (Tauri) → `map-service.createMap()` → erscheint in Liste
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### MI-S08: M5 Cards & Export verdrahten

**Ziel:** Cards werden aus der DB projiziert, Print Sheet und Export funktionieren.

**AC:**
- Cards-Bereich zeigt `CardList` via `card-service.listCards()` mit `database` aus Context
- Klick auf Card → `CardPreview` mit `cardId` und `database`
- `CardCreationFlow` speichert neue Card via `card-service.createCard()`
- `PrintSheetComposer` erhält Liste selektierter Cards, exportiert via `pdf-export` / `png-export`
- PDF-Export via `pdf-export.ts`: Tauri save-dialog → Datei schreiben
- PNG-Export via `png-export.ts`: Tauri save-dialog → Datei schreiben
- Handout-Export via `handout-service` + `player-view-export`: sichtbarkeitsgefilterter HTML-Export
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### MI-S09: M6 Plugins verdrahten

**Ziel:** Plugin-Manager zeigt geladene Plugins, Plugins werden beim App-Start geladen.

**AC:**
- `plugin-loader.loadAllPlugins()` wird beim App-Start (nach DB-Init) aufgerufen
- Plugin-Bereich mountet `PluginManager` — zeigt geladene Plugins via `getPluginRegistry()`
- Plugin-Entities via `plugin-entity-service` sind in `EntityMasterDetail` als zusätzliche Types sichtbar
- Plugin-Assets via `plugin-asset-service` werden in `MapViewer` und `CardPreview` aufgelöst
- `renderer-registry` ist beim Start initialisiert — alle Core-Renderer registriert
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### MI-S10: M6 Rules & DM Screen verdrahten

**Ziel:** Rules-Referenz und DM Screen zeigen echte Daten aus der DB.

**AC:**
- Rules-Bereich mountet `DmScreenSelector` + `DmScreen` mit `database` aus Context
- `DmScreenSelector` lädt Screens via `listScreens()`, erstellt neue via `saveScreen()`
- `DmScreen` lädt Panels und löst Quellen auf: `rule_table`-Panels via `listRuleEntities()`, `entity_type`-Panels via `listEntitiesByType()`
- Rule-Import: Button → File-Dialog → `rule-import-service.importRules()` → Regeln in DB
- `rule-evaluations.ts`: Mystery-Breaker / Role-Coverage / Quest-Dependency werden im Rules-Bereich als aufrufbare Checks angeboten
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### MI-S11: M7 Project Operations verdrahten

**Ziel:** Snapshot-Manager und ZIP-Import/Export sind aus der App erreichbar und funktionieren.

**AC:**
- Project-Bereich in Sidebar öffnet Projekt-Einstellungen: `SnapshotManager` + ZIP-Export-Button + Projekt-Metadaten
- `SnapshotManager` erhält `projectId` und `projectDir` aus App-State, `onRestored` → App neu laden
- ZIP-Export-Button: `zip-export-service.exportProjectZip()` → Tauri save-dialog → Datei schreiben
- ZIP-Import: erreichbar von WelcomeScreen (`onImportZip`) und aus Projekt-Bereich
- `UpdateNotification` mountet einmalig im App-Shell, zeigt Update-Hinweis wenn verfügbar
- `GlobalEntityGraph` und `EntityReadingView` sind als zusätzliche View-Modi im Entity-Workspace erreichbar
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

## Story Tracking

| Story | ID | Milestone-Bezug | Titel |
|---|---|---|---|
| MI-S00 | #190 | Cross | Node.js Service-Layer auf Tauri Plugins migrieren |
| MI-S01 | #170 | M7 + Cross | App Shell — Projekt-Lifecycle & Routing |
| MI-S02 | #171 | Cross | Database Context & Workspace-Shell |
| MI-S03 | #172 | M1–M2 | Entity-Workspace verdrahten |
| MI-S04 | #173 | M3 | Suche verdrahten |
| MI-S05 | #174 | M4 | Session-Modus verdrahten |
| MI-S06 | #175 | M5 | Kalender & Zeit verdrahten |
| MI-S07 | #176 | M5 | Maps verdrahten |
| MI-S08 | #177 | M5 | Cards & Export verdrahten |
| MI-S09 | #178 | M6 | Plugins verdrahten |
| MI-S10 | #179 | M6 | Rules & DM Screen verdrahten |
| MI-S11 | #180 | M7 | Project Operations verdrahten |
