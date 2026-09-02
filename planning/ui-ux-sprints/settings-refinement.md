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

- **Increment 3 (Feedback aus Screenshot):**
  - **Screen-Titel „Einstellungen"** statt „Projekt" (`settings__title` = `t('settingsTitle')`,
    nav-Locale-Key `settingsNavAria` → `settingsTitle` umbenannt). Der redundante
    „EINSTELLUNGEN"-Header **innerhalb** der Side-Nav entfällt (aria-label bleibt).
  - **Darstellung-Pane klarer strukturiert:** der Theme-Switcher hat jetzt ein sichtbares
    Label „Theme" (vorher nur aria-label → Buttons wirkten kontextlos); darunter eine
    eigene Gruppe „Eigene Themes" mit Hinweistext + zwei Aktionen.
  - **Themes live nachladen (kein Neustart):** neuer Button „Themes neu einlesen" ruft
    `scanUserThemes(userThemesDir())` live auf und rendert die Liste neu → in den Ordner
    gelegte `.json`-Themes erscheinen **sofort** als weitere Buttons (mit Akzent-Swatch).
    Feedback-Zeile („Neu geladen: N" / „Keine neuen Themes gefunden."). Vorher wurden
    User-Themes nur beim App-Start gescannt (`bootstrapUserThemes`).
  - Neue token-basierte Klassen `theme-picker__group-label`/`__hint` (keine Hex/Inline).
  - Verifiziert: tsc 0, eslint 0, Farb-Gate 0, i18n 0/0, Theme-DOM-Tests 17 grün.

- **Increment 4 (Feedback: Themes untereinander + Support-Info):**
  - **Theme-Switcher = vertikale Liste** (`ThemePicker.tsx`): statt `Segmented` jetzt eine
    `role="radiogroup"` mit einer `ListRow` pro Theme (`role="radio"` + `aria-checked`,
    Klick → `pick`). Links weiterhin Akzent-Swatch + Theme-Name; **rechts** zwei `StatusChip`-
    Badges, die zeigen, was das Theme unterstützt: **Modus-Achse** (`modeSupport`:
    „Einheitlich"/„Pro Modus") und **Hell/Dunkel-Achse** (`appearanceSupport`:
    „Hell & Dunkel"/„Nur Hell"/„Nur Dunkel"). Über `u-justify-between` an die Kanten gelegt.
  - Neue i18n-Gruppe `themeCap` in `common` (de+en): unified/perMode/appBoth/appDark/appLight.
  - Token-CSS `theme-picker__row .theme-picker__option` (Name wächst) + `theme-picker__caps`
    (Badges bleiben rechts intakt) — keine Hex/Inline.
  - Verifiziert: tsc 0, eslint 0, Farb-Gate 0, i18n 0/0, Theme-DOM-Tests 37 grün.
    (Visuelle Preview nicht möglich — Projekt-Anlage braucht Tauri-Backend, im reinen
    Vite-Dev-Server wirft `invoke`.)

- **Increment 5 (Feedback: Backup fehlt CSS — F3 behoben):**
  - **SnapshotManager komplett auf Primitives umgebaut** (`SnapshotManager.tsx`): die 7 rohen
    `<button>` + rohes `div/label/input/ul/li` sind weg. Jetzt: **Create-Zeile** oben
    (`Field` + `Button tone=accent`, Enter-to-create, bei leerem Namen disabled) und darunter
    eine **Liste** (`ListSurface`/`ListRow`) mit je Name + Meta (Datum · Größe) links und den
    Aktionen **Wiederherstellen** (`Button outline`) + **Löschen** (`Button outline danger`)
    rechts. Leerzustand als eigener Hinweis (`snapshot.empty`, de+en).
  - **Bestätigungen** (Restore/Delete) zu **einem** zentrierten Modal-Overlay zusammengefasst
    (Scrim-Backdrop `--color-scrim`, `Panel` + Cancel/Confirm), Confirm bei Delete in `danger`.
  - Pane bekommt jetzt einen `settings__pane-title` „Backup" wie die anderen Panes
    (interner `<h2>` aus dem SnapshotManager entfernt).
  - Token-CSS `snapshot__*` in `settings.css` (keine Hex/Inline; Scrim/Border/Text aus Tokens).
  - Verifiziert: tsc 0, eslint 0, Farb-Gate 0, i18n 0/0, Snapshot-DOM-Tests 12 grün,
    Session-Strings-Parität 30 grün.

  - **Nachtrag:** unter der Liste ein inline „Bald"-Teaser **Automatische Backups**
    (⏱️ + `StatusChip tone=warning` „Bald" + Kurztext, wie Plugins/Shortcuts, aber
    linksbündig statt zentriert). i18n `settingsBackupAuto.title/body` (de+en),
    Klassen `settings__teaser-icon/-title`.

- **Increment 6 (Feedback: Engine gehört nicht in About):**
  - **„Engine"-Zeile aus dem About-Pane entfernt** — RuleLoom ist nur die *Plugin-/Regel-
    Engine*; bei deaktiviertem Plugin-System ergibt sie in „Über" keinen Sinn.
  - **Engine-Version zieht in den Plugin-Bereich**: kleines Corner-Label oben rechts im
    Plugins-Pane (`settings__corner-meta`), Text „Engine-Version: RuleLoom v1.0".
  - Neue Konstante `ENGINE_VERSION = '1.0'` in `branding/brand.ts` (sprachneutral, kein i18n);
    neuer Label-Key `settingsPluginsEngine` (de+en); `settingsAbout.engine` entfernt.
  - Verifiziert: tsc 0, eslint 0, Farb-Gate 0, i18n 0/0, Nav-Strings 15 + Branding 8 grün.

- **Increment 7 (Feedback: Firmenname + Copyright in About):**
  - **Firma „Aethermages" ins Brand-Modul** (`brand.ts`): `Brand.company` + `useBrand().company`
    + Locale-Key `brand.company` (common, de+en). Schließt die #381-Lücke (der Firmen-/
    Gruppenname war damals „raus-optimiert", weil nirgends verwendet).
  - **About-Pane:** neue Zeile **Firma: Aethermages** + Copyright-Zeile unten
    **„© 2026 Aethermages. Alle Rechte vorbehalten."** (en: „All rights reserved.").
  - Startjahr als Konstante `COPYRIGHT_START_YEAR = 2026`; die Zeile weitet sich automatisch
    zu „2026–<Jahr>", sobald das Jahr wechselt. i18n `settingsAbout.company` +
    `settingsCopyright` (nav, de+en, `{{years}}`/`{{company}}`).
  - Verifiziert: tsc 0, eslint 0, Farb-Gate 0, i18n 0/0, Nav-Strings 15 + Branding 8 grün.

- **Fix (Feedback: About zeigt noch AppData):** die „Datenordner"-Zeile zeigte weiter
  `<appDataDir>\WorldsAndBeyond` (interner Config-Ort), obwohl #406 die Nutzerdaten
  (projects/themes/plugins/help) nach `Documents\WorldsAndBeyond` verschoben hat.
  `dataDir` liest jetzt `userDataDir()` (Documents); `app-config.json` wird weiterhin aus
  `appDataDir()` gelesen (intern, unverändert). „Öffnen" öffnet damit den richtigen Ordner.
- **Fix (Feedback: nicht hart verdrahten — Datenpfad aus der Config):** der Datenpfad war an
  mehreren Stellen hart `Documents\WorldsAndBeyond` (→ Anzeige und tatsächlich genutzter Pfad
  konnten divergieren, „kann überall knallen"). Jetzt **eine Quelle der Wahrheit**: neues
  Feld `data_dir` in `app-config.json`; `userDataDir()` liest es (Fallback = Plattform-Default
  `Documents\WorldsAndBeyond`). Damit folgen **alle** Verbraucher (Projekte, Themes, ZIP-Import,
  About) automatisch der Config. Die Config-Datei selbst bleibt im `appDataDir` (Bootstrap —
  kann sich nicht selbst verorten); nur die Daten-Location ist konfigurierbar. Rückwärts-
  kompatibel (kein `data_dir` gesetzt → identisches Verhalten wie bisher).
  TDD: `tests/pre-datadir-from-config.test.ts` (5 Fälle). Verifiziert: tsc 0, eslint 0,
  Farb-Gate 0, i18n 0/0, 77 verwandte Tests grün.
- **Nachtrag (Default persistieren):** `ensureUserDataDirs()` schreibt den aufgelösten
  Default beim First-Run **explizit** in `app-config.json` (`data_dir`), sofern noch keiner
  gesetzt ist — eine spätere Nutzer-Wahl wird nie überschrieben; best-effort (non-Tauri /
  nicht schreibbar → übersprungen, Fallback greift weiter). Kein UI zum Ändern des Ordners
  (bewusst nicht nötig). +2 TDD-Fälle (schreibt Default / überschreibt bestehenden nicht).

### Offen (nächste Sprint-Increments)
- **Nutzerdefinierbare Shortcuts** (Keybind-Engine + Persistenz) — aktuell Teaser.
- **Automatische Backups** (Scheduler + Persistenz) — aktuell Teaser.
- UpdateNotification-interne rohe Buttons (F4) auf Primitives (falls es woanders bleibt).
