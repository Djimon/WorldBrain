# UI/UX-Sprint: Settings-Refinement (#410 / Pre-Release #6)

Scope: **nur Präsentation/Interaktion** der beiden Settings-Flächen — Edit `project`
(`WorkspaceShell.tsx` `case 'project'`) und Play `play-settings`. Keine Services/Schema/
Datenmodell. Basics aus `src/ui/primitives.tsx`, Farben aus Tokens, i18n über `t()`.

## Ist-Zustand / Findings (Start)

- **F1 — Layout-Bug (Edit-Settings):** `.workspace-area` ist `display:flex` (flex-row); der
  `project`-Case nutzt es OHNE `--column` → die Sektionen (Darstellung/Speicherstände/Update/
  Schließen) laufen **horizontal nebeneinander** (cramped Spalten). Play-Settings hat denselben
  Container — gleiche Gefahr.
- **F2 — Rohes `<button>` (Edit):** „Projekt schließen" (`WorkspaceShell.tsx:876`) ist ein
  ungestyltes `<button>` statt Primitive `Button` (DEV-UI-GUIDE-Verstoß). Play-Settings macht's
  richtig (`Button tone="danger" variant="outline"` für „Session verlassen").
- **F3 — SnapshotManager:** 7× rohes `<button>`, kein Primitives-Import → „Create snapshot"/
  „Wiederherstellen"/„Löschen" ungestylt.
- **F4 — UpdateNotification:** 2× rohes `<button>` → „Installieren"/„Schließen" ungestylt.
- **F5 — Konsistenz:** Edit- und Play-Settings sollen sich gleich anfühlen (Sektions-Gruppierung,
  Abstände, Divider).

## Entscheidung (Mockup-Review)

- **Layout = Variante A (Sidebar & Detail)** — Kategorien links (Project · Appearance · Backup ·
  Shortcuts · About), Detail rechts. Mockup: `settings-concepts.html` (Artifact).
- Umgesetzt im Sprint: Sidebar-Layout, Appearance (ThemePicker), **Backup** (SnapshotManager,
  umbenannt), About (Version/Engine/Plattform/Datenordner/Sprache), **Version oben rechts**,
  „Close project" im Project-Bereich.
- **Ausgelagert als Feature-Stories** (brauchen Services/Persistenz → nicht Sprint-Scope):
  - Nutzerdefinierbare Tastenkürzel (Keybind-Engine + Persistenz).
  - Projekt-Info/-Wechsler/-Umbenennen (project-ops-Service: DB-Größe, Counts, Liste, Rename).
- „Updates" (UpdateNotification) im Settings-Screen **entfernt** (Platzhalter).

## Change-Log

- **Variante A implementiert** (`SettingsPanel.tsx` + `settings.css`): Sidebar (Project/
  Plugins/Appearance/Backup/Shortcuts/About) + Detail-Pane; ersetzt den kaputten flex-row
  `case 'project'` in `WorkspaceShell`. Behebt F1 (Layout) + F2 (rohes Close-Button →
  `Button`-Primitive).
- **Guide-konform komponiert:** `ListSurface`/`ListRow` (Sidebar-Nav + Projekt-Switcher, inkl.
  Active-Accent-Bar), `StatusChip` (Pills/Badges), `Panel` (Stat-Kacheln), Utilities fürs
  Flex; Component-CSS nur für Struktur-Reste; alle Farben aus Tokens.
- **Mini-Features (im Sprint erlaubt, da UX):** Projekt-Stats (DB-Größe via `fs.stat`,
  Entity-/Map-Counts via DB), Projekt-Switcher (`readAppConfig().projects`, aktives via
  `ListRow selected`, Klick → `onOpenProject` durchgereicht von `App`), Datenordner + Öffnen.
- **„Snapshots" → „Backup"** (`session:snapshot.title`).
- **„Updates" entfernt** (UpdateNotification nicht mehr im Settings-Screen).
- **Version oben rechts** (`StatusChip` mit `v{package.json version}`).
- **Plugins + Shortcuts = „Bald"-Teaser** (Sneak-Peek; Features in 0.1 raus bzw. später).
- **Icons = Emoji** (📁🔌🎨💾⌨️ℹ️) statt obskurer Sonderzeichen → konsistente Glyph-Darstellung.
- **First-Start-Bug gefixt** (`App.tsx`): `last_opened_project_id` wird beim Öffnen jetzt
  persistiert → nächster Start öffnet das Projekt direkt statt Welcome-Screen.
- Verifiziert: tsc 0, eslint 0, Farb-Gate 0, i18n-Scanner 0/0, Parität 30/30.

- **Projekt-Pane-Ausbau (Increment 2):** Titel **+ Beschreibung inline editierbar** (Edit-Button
  neben dem Titel; `save`/`cancel` aus `common`). Neuer Service `readProjectMeta`/`updateProjectMeta`
  (schreibt `project.json`, bumpt `updated_at`, **kein** Ordner-Rename — Slug bleibt); Titel wird
  zusätzlich in `app-config` (`registerProject`) gesynct. Live-Header-Update via `onProjectRenamed`
  (App → Shell → Panel). Pfad zeigt jetzt den **echten `projectDir`** mit Label „Projekt-Ordner:"
  (vorher fälschlich der gemeinsame App-Ordner `…\projects`). Projekt-Switcher **unter** „Close
  project" verschoben und listet nur die **anderen** Projekte.

### Offen (nächste Sprint-Increments)
- **Nutzerdefinierbare Shortcuts** (Keybind-Engine + Persistenz) — aktuell Teaser.
- SnapshotManager/UpdateNotification-interne rohe Buttons (F3/F4) auf Primitives (falls
  UpdateNotification woanders bleibt).
