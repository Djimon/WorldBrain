# EPIC-012: Project Operations & Packaging

## Goal

Projekte portabel, wiederherstellbar und als installierbare Desktop-App auslieferbar machen.

## Decisions

1. **App-Verzeichnis:** Festes, App-verwaltetes Verzeichnis für alle Projekte. Endnutzer sieht nie die Ordnerstruktur direkt.
2. **Welcome Screen:** Nur beim Erststart oder wenn kein Projekt existiert. Danach öffnet die App immer das zuletzt verwendete Projekt direkt.
3. **Speicherstände:** Manuell benannte Snapshots (kein automatisches Backup). Intern als Ordner-Kopie, nicht als ZIP.
4. **Restore:** Destructive Replace mit Warnhinweis. Ungespeicherte Änderungen gehen verloren.
5. **ZIP Export/Import:** ZIP für den Austausch mit Dritten. Import-Konflikt bei identischem Projektnamen → Dialog "Überschreiben?" oder "Beide behalten" (Rename mit `(1)`, `(2)` …).
6. **Tauri Build:** `tauri build` als explizites M7-Deliverable inkl. Auto-Updater (Tauri built-in).
7. **App-Konfiguration:** Globale App-Config-Datei (zuletzt geöffnetes Projekt, App-Einstellungen).
8. **Session-Persistenz:** Out of Scope → M8.
9. **`.gitignore`:** Entwickler-Infrastruktur, kein User-Feature, kein Story.

## Out of Scope

- Git UI
- Cloud Sync
- Team-Kollaboration
- Session-Objekte (→ M8)
- Automatische Hintergrund-Backups

## Stories

### M7-S01: App-Konfiguration & Projekt-Registry

**Ziel:** Die App merkt sich welche Projekte existieren und welches zuletzt geöffnet war.

**AC:**
- Globale App-Config-Datei (`app-config.json`) im App-Datenverzeichnis (Tauri `appDataDir`)
- Felder: `last_opened_project_id`, `projects: [{id, title, path}]`
- Config wird beim Start gelesen, beim Öffnen/Erstellen/Löschen eines Projekts aktualisiert
- Fehlerhafte Config (korrupt/fehlend) führt zum Welcome Screen, nicht zum Crash
- database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M7-S02: Welcome Screen & Projekt-Launcher

**Ziel:** Erster Bildschirm beim Erststart oder wenn kein Projekt vorhanden ist.

**AC:**
- Welcome Screen erscheint nur wenn `projects` in App-Config leer ist oder kein `last_opened_project_id` existiert
- Welcome Screen zeigt: "Neues Projekt erstellen" + "Bestehendes ZIP importieren"
- Existieren bereits Projekte: Screen zeigt zusätzlich eine Liste der letzten Projekte (klickbar)
- Bei vorhandenem `last_opened_project_id`: App öffnet dieses Projekt direkt, kein Welcome Screen
- Wenn `last_opened_project_id` auf ein nicht mehr existierendes Projekt zeigt: Welcome Screen mit Hinweis
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M7-S03: Neues Projekt anlegen

**Ziel:** Nutzer legt ein neues, leeres Projekt an.

**AC:**
- Dialog: Projektname (Pflichtfeld), optional: Beschreibung
- App legt Projektordner im App-verwalteten Verzeichnis an: `projects/<slug-aus-name>/`
- Ordnerstruktur wird initialisiert: `project.json`, `entities/`, `maps/`, `sessions/`, `assets/`, `plugins/`
- `project.json` enthält: `id` (ULID), `title`, `schema_version`, `created_at`, `updated_at`
- Projektname-Konflikt (Ordner existiert bereits): Fehlerhinweis im Dialog, kein stiller Override
- Projekt wird in App-Config registriert und sofort geöffnet
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M7-S04: Benannte Speicherstände (Snapshots)

**Ziel:** Nutzer kann jederzeit einen benannten Speicherstand des aktuellen Projekts anlegen, wiederherstellen und löschen.

**AC:**
- Speicherstand = vollständige Ordner-Kopie unter `snapshots/<project-id>/<timestamp>-<name>/`
- Nutzer vergibt beim Anlegen einen Namen (Pflichtfeld, z.B. "vor großem Umbau")
- Liste aller Speicherstände im UI: Name, Datum, Größe
- **Restore:** Dialog mit Warnung "Aktuelle Änderungen gehen verloren — fortfahren?" → Ja/Abbrechen
- Restore ersetzt den kompletten Projektordner (destructive replace)
- Löschen eines Speicherstands: Bestätigungsdialog
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M7-S05: ZIP Export

**Ziel:** Nutzer exportiert das aktuelle Projekt als ZIP-Datei zur Weitergabe oder externen Sicherung.

**AC:**
- Export erzeugt ein ZIP der kompletten Projektordner-Struktur
- ZIP-Dateiname: `<project-title>-<YYYY-MM-DD>.zip`
- Nutzer wählt Speicherort via Tauri save-dialog
- Vor dem Export: automatisch ein Speicherstand angelegt (Name: `pre-export-<timestamp>`)
- SQLite Runtime-DB und Snapshot-Ordner sind vom ZIP ausgeschlossen
- Fortschrittsanzeige bei großen Projekten (Assets)
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M7-S06: ZIP Import

**Ziel:** Nutzer importiert ein Projekt-ZIP und kann es direkt öffnen.

**AC:**
- Nutzer wählt ZIP-Datei via Tauri open-dialog
- ZIP wird validiert: muss `project.json` im Root enthalten, sonst Fehlermeldung
- **Konflikt bei identischem Projekt-ID oder -Name:** Dialog mit zwei Optionen:
  - "Überschreiben" → bestehende Projekt-Ordner wird ersetzt (mit Warnhinweis)
  - "Beide behalten" → Import landet als `<name> (1)`, `<name> (2)` usw.
- Nach erfolgreichem Import: Projekt wird in App-Config registriert und geöffnet
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M7-S07: Tauri Build & Auto-Updater

**Ziel:** Die App ist als installierbares Desktop-Paket auslieferbar und kann sich selbst aktualisieren.

**AC:**
- `tauri build` erzeugt einen funktionierenden Installer (`.exe` auf Windows, `.dmg` auf macOS)
- Tauri Auto-Updater konfiguriert (`tauri.conf.json`: `updater.active: true`, Endpoint-Platzhalter)
- App zeigt beim Start einen Hinweis wenn ein Update verfügbar ist (non-blocking, dismissible)
- Build-Prozess ist in `package.json` als `npm run build:desktop` dokumentiert
- Kein Auto-Download ohne explizite Nutzer-Bestätigung

## Story Tracking

| Story | ID | Titel |
|---|---|---|
| M7-S01 | #134 | App-Konfiguration & Projekt-Registry |
| M7-S02 | #135 | Welcome Screen & Projekt-Launcher |
| M7-S03 | #136 | Neues Projekt anlegen |
| M7-S04 | #137 | Benannte Speicherstände (Snapshots) |
| M7-S05 | #138 | ZIP Export |
| M7-S06 | #139 | ZIP Import |
| M7-S07 | #140 | Tauri Build & Auto-Updater |

## Sources

- `worldbuilding_architecture_study/08_UI_Plugin_Architecture.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
