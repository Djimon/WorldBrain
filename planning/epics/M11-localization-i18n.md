# EPIC-017: Localization / i18n

## Goal

Die Anwendung wird mehrsprachig. Initial werden **Englisch** und **Deutsch** ausgeliefert; eigene
Sprachen lassen sich **per JSON-Datei** (in VS Code o.ä. editierbar) ohne Rebuild hinzufügen. Heute
sind ~170 UI-Strings über ~30 Dateien hartcodiert und sprachlich gemischt (teils DE, teils EN) —
es gibt keinen gemeinsamen Schlüssel-Layer, kein Framework, keine `t()`-Funktion.

Grundlage: `docs/handover-i18n.md`.

## Decisions

1. **Framework: react-i18next + i18next.** Industriestandard mit Namespaces, Pluralformen, Interpolation, Fallback und lazy load. JSON-Locales sind das native Format — „eigene Sprache per .json" fügt sich direkt ein.
2. **Sprachen initial: `en` + `de`.** `en` ist Fallback-Sprache **und** kanonische Basis: jeder Key existiert auf `en`. Ein Test erzwingt `en`/`de`-Parität.
3. **Eigene Sprachen als drop-in JSON.** Ein userland-Verzeichnis (`<appDataDir>/locales/<lang>/<namespace>.json`) wird beim Start via `@tauri-apps/plugin-fs` gescannt; gefundene Dateien ergänzen/überschreiben gebündelte Keys. Kein Rebuild, in VS Code editierbar.
4. **Voller Scope, gestaffelt.** Übersetzt werden UI-Strings **+** Entity-Typ-Namen (`displayName`) **+** System-Plugin-gelieferte Strings. Die drei Schichten sind in getrennte Stories geschnitten; Plugin-Strings koppeln an das M9-S01-Manifest-Format.
5. **Namespace-Split.** Locales werden nach Bereich aufgeteilt (`common`, `nav`, `entity`, `map`, `session`, `plugin:<id>`) für Übersicht und lazy load.
6. **Kanonische IDs bleiben sprachneutral.** Entity-Typ-IDs (`Character`, `Location`) und Keys sind Speicher-/Referenzwerte; nur das Display-Label wird übersetzt. Kein Datenumbau bei Sprachwechsel.
7. **Fehlende Übersetzung → Fallback, kein Crash.** Fehlt ein Key in der aktiven Sprache → `en`; fehlt auch dort → Key sichtbar (dev). Plugin-Strings fallen auf den plugin-kanonischen String zurück, nicht auf Core-`en`.
8. **Sprachwechsel zur Laufzeit** ohne App-Reload; Auswahl wird persistiert (App-Settings).

## Out of Scope

- RTL-Layout (Arabisch/Hebräisch) — später
- Übersetzung nutzer-erstellten Inhalts (Entity-Texte, Homebrew-Regeltexte) — bleibt in Autorensprache
- Maschinelle/automatische Übersetzung
- Service-/Log-/Error-Strings (`console.error`, `throw`) — Logging-Convention separat
- Zahlen-/Datumsformat-Lokalisierung (In-World-Kalender hat ein eigenes System)

## Stories

### M11-S01: i18n-Fundament (react-i18next, Locale-Loader, Sprachwechsel)

**Ziel:** i18n-Fundament auf Basis von react-i18next, inkl. Laden gebündelter Locales, Fallback und Sprachwechsel zur Laufzeit.

**AC:**
- `react-i18next` + `i18next` als Dependency hinzugefügt; i18n-Init am App-Root, `useTranslation()`/`t()` app-weit verfügbar
- Gebündelte Locales unter `src/locales/en/*.json` und `src/locales/de/*.json`, aufgeteilt nach Namespaces (`common`, `nav`, `entity`, `map`, `session`, …)
- Fallback-Sprache = `en`. Fehlender Key → Fallback `en`; fehlt auch dort → Key sichtbar (kein Crash, kein leerer String)
- Externe Locale-Ordner: beim Start wird `<appDataDir>/locales/` via `@tauri-apps/plugin-fs` gescannt; gefundene `<lang>/<namespace>.json` werden registriert und ergänzen/überschreiben gebündelte Keys → eigene Sprache per JSON ohne Rebuild, in VS Code editierbar
- Sprachauswahl-UI (Dropdown in Settings/Header) listet gebündelte + extern gefundene Sprachen; Wechsel zur Laufzeit **ohne App-Reload**; Auswahl wird persistiert (App-Settings)
- Keine `prompt()`, `alert()`, `confirm()`; alle Eingaben über gerendertes UI

---

### M11-S02: UI-String-Migration — Navigation, Shell & Onboarding

**Ziel:** Höchst-sichtbare Kern-Oberfläche (Onboarding + globale Navigation) auf `t()` umstellen.

**AC:**
- `WelcomeScreen.tsx`, `WorkspaceShell.tsx` (Sidebar-/Nav-Labels), `NewProjectDialog.tsx` vollständig über `t()`
- Alle Navigations-Labels aus einem `nav`-Namespace; die heutige Sprachmischung (`Karten` / `Cards` / `Chronik`) ist konsolidiert und in EN+DE konsistent
- Keine hartcodierten nutzer-sichtbaren Strings mehr in diesen Dateien (JSX-Text, `label:`, `placeholder=`, `aria-label=`)
- `en`- und `de`-Keys für diesen Bereich vollständig vorhanden (Parität)

---

### M11-S03: UI-String-Migration — Editor, Detail-Views & Formulare

**Ziel:** Editor-, Detail- und Formular-Oberflächen lokalisieren.

**AC:**
- Umgestellt: `EntityDetailView.tsx`, `PropertiesForm.tsx`, `RelationsTab.tsx`, `BodyEditor.tsx`, `ConditionBuilder.tsx`, `CaptureInbox.tsx`
- `placeholder=` und `aria-label=` mit übersetzt
- Keine hartcodierten nutzer-sichtbaren Strings mehr in diesen Dateien
- `en`- und `de`-Keys für diesen Bereich vollständig (Parität)

---

### M11-S04: UI-String-Migration — Maps, Session & Play-Mode

**Ziel:** Maps-, Session- und Play-Mode-Oberflächen lokalisieren (inkl. spieler-sichtbarer Strings).

**AC:**
- Umgestellt: `MapGrid.tsx`, `MapViewer.tsx`, `MapMarkers.tsx`, `DmScreen.tsx`, `PlayerScreen.tsx`, `EncounterCounters.tsx`, `SessionClock.tsx`, `ChronicleView.tsx`, `CalendarWizard.tsx`, `SnapshotManager.tsx`, `ZipImportDialog.tsx`, `PrintSheetComposer.tsx`
- Spieler-sichtbare Strings (`PlayerScreen`, `DmScreen`) folgen der aktiven Sprache
- Keine hartcodierten nutzer-sichtbaren Strings mehr in diesen Dateien
- Bei HTML-Export (`PrintSheetComposer`): alle nutzer-gelieferten Strings HTML-escaped vor Interpolation; CSP-Meta-Tag im Output vorhanden
- `en`- und `de`-Keys für diesen Bereich vollständig (Parität)

---

### M11-S05: Entity-Typ-Namen i18n (displayName)

**Ziel:** Entity-Typ-Namen (Character, Location, Faction, Item, Event …) werden übersetzbar, ohne die kanonische ID als Speicher-/Referenzwert zu ändern.

**AC:**
- `core_data/entity-type-schemas.ts`: jeder Entity-Typ erhält einen i18n-Schlüssel für sein `displayName`; die kanonische ID bleibt sprachneutraler Schlüssel/Speicherwert
- UI rendert das übersetzte `displayName` (z.B. `Character` → `Charakter`/`Character`); Fallback = kanonische ID
- Kern-Typen abgedeckt: Character, Location, Faction, Item, Event (+ alle in `entity-type-schemas.ts` definierten)
- Speicher- und Relationsdaten nutzen weiterhin die ID, nicht das Label → **keine** Datenmigration bei Sprachwechsel
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`) an betroffenen Call-Sites; keine `unknown`/`as never` Casts

---

### M11-S06: System-Plugin-String-Lokalisierung

**Ziel:** System-Plugins können Übersetzungen für ihre eigenen Strings mitliefern (Entity-Typ-Labels, Feld-Labels, `ui_schema`-Texte).

**Blockiert durch:** M9-S01 (#164) — das Plugin-Manifest-Format muss zuerst stehen.

**AC:**
- Plugin-Manifest-Format (M9-S01) wird um optionale Locale-Dateien erweitert (z.B. `locales/<lang>.json` im Plugin bzw. i18n-Block im Manifest)
- Der Core registriert Plugin-Locales im selben i18n-Layer unter eigenem Namespace (`plugin:<plugin_id>`)
- Fehlt eine Plugin-Übersetzung → Fallback auf den plugin-kanonischen String (nicht auf Core-`en`)
- Nutzer-Homebrew-Inhalt bleibt in Autorensprache (wird nicht übersetzt)
- `database` prop typed as `DatabaseLike`; keine `unknown`/`as never` Casts

---

### M11-S07: Übersetzungs-Parität, Tests & „Eigene Sprache"-Doku

**Ziel:** Übersetzungs-Qualität absichern und dokumentieren, wie man eine eigene Sprache hinzufügt.

**AC:**
- Test erzwingt Key-Parität: jeder Key in `en` existiert in `de` und umgekehrt; fehlende/verwaiste Keys → Testfehler (Testdatei-Präfix `m11-s07-`)
- Guard gegen neue hartcodierte, nutzer-sichtbare JSX-Strings in den migrierten Dateien (ESLint-Regel oder Scan-Test; best effort)
- `locales/README.md` dokumentiert die Ordnerstruktur und den Weg, per JSON-Datei eine eigene Sprache hinzuzufügen (Namespace-Dateien, in VS Code editieren, App neu starten)
- Optional: Pseudo-Locale zur QA fehlender Keys

## Story Tracking

| Story | ID | Prio | Blockiert durch | Titel |
|---|---|---|---|---|
| M11-S01 | #209 | p0 | — | i18n-Fundament (react-i18next, Locale-Loader, Sprachwechsel) |
| M11-S02 | #210 | p0 | — | UI-String-Migration — Navigation, Shell & Onboarding |
| M11-S03 | #211 | p1 | — | UI-String-Migration — Editor, Detail-Views & Formulare |
| M11-S04 | #212 | p1 | — | UI-String-Migration — Maps, Session & Play-Mode |
| M11-S05 | #213 | p1 | — | Entity-Typ-Namen i18n (displayName) |
| M11-S06 | #214 | p2 | #164 | System-Plugin-String-Lokalisierung |
| M11-S07 | #215 | p1 | — | Übersetzungs-Parität, Tests & „Eigene Sprache"-Doku |

## Abhängigkeiten

- S01–S05, S07: keine harte Vorbedingung — reine UI-/Schema-Arbeit auf bestehendem Code.
- S06: hängt an M9-S01 (#164) Plugin-Manifest-Format → `status: blocked`.
- Hinweis: Der String-Layer berührt fast alle UI-Dateien. Nach größeren UI-Umbauten laufen lassen, um Merge-Konflikte zu minimieren.
