# Analyse: I18n / Mehrsprachigkeit

Stand: 2026-07-01. Eingabe für Requirements-Engineering, kein Implementierungsplan.

## Befund

Alle UI-Strings sind hartcodiert — teils Deutsch, teils Englisch, ohne gemeinsamen Schlüssel-Layer.
Es gibt kein i18n-Framework, keine Übersetzungsdateien, keine `t()`-Funktion.

## Betroffene Dateien (nach Anzahl hartcodierter Strings)

| Datei | Strings (geschätzt) | Sprache |
|---|---|---|
| `src/ui/MapGrid.tsx` | 18 | DE |
| `src/ui/MapViewer.tsx` | 17 | DE/gemischt |
| `src/ui/WorkspaceShell.tsx` | 13 | DE/EN |
| `src/ui/EntityDetailView.tsx` | 11 | DE |
| `src/ui/DmScreen.tsx` | 9 | DE |
| `src/ui/ZipImportDialog.tsx` | 8 | DE |
| `src/ui/SnapshotManager.tsx` | 8 | DE |
| `src/ui/RelationsTab.tsx` | 8 | DE |
| `src/ui/ConditionBuilder.tsx` | 8 | DE |
| `src/ui/CaptureInbox.tsx` | 8 | DE |
| `src/ui/PrintSheetComposer.tsx` | 7 | DE |
| `src/ui/EncounterCounters.tsx` | 7 | DE |
| `src/ui/CalendarWizard.tsx` | 7 | DE |
| `src/ui/ChronicleView.tsx` | 6 | DE |
| `src/ui/NewProjectDialog.tsx` | 5 | DE |
| `src/ui/MapMarkers.tsx` | 5 | DE |
| `src/ui/EntityGraph.tsx` | 5 | DE |
| `src/ui/BodyEditor.tsx` | 5 | DE |
| `src/ui/WelcomeScreen.tsx` | 4 | DE |
| `src/ui/SessionClock.tsx` | 4 | DE |
| weitere (~10 kleinere) | 1–3 je | DE |

**Gesamt: ~170 Strings in ~30 Dateien.**

## String-Kategorien

- **Inline JSX-Text** (`>Kein Kartenbild<`, `>Entity nicht gefunden.<`): ~130 Stellen — größter Block.
- **`label:`-Properties** in Datenkonstanten (z.B. `VISIBILITY_OPTIONS`, `PIN_ICONS`, Sidebar-Nav): ~20 — teils deutsch, teils englisch (`'Cards'`, `'Chronik'`, `'Karten'`).
- **`placeholder=`/`aria-label=`**: ~9 Stellen in Formularen/Inputs.
- **Error-/Statusmeldungen** in Services (`console.error`, `throw`): Englisch, wären durch Logging-Convention separat zu behandeln.

## Sprachmischung (aktuell)

Nicht konsistent. Beispiele nebeneinander:
- Sidebar-Labels: `'Karten'` (DE) neben `'Cards'` (EN) neben `'Chronik'` (DE)
- Entity-Typen: `'Character'`, `'Location'`, `'Faction'`, `'Item'`, `'Event'` — alle Englisch (kommen aus System-Plugin-Schema, nicht aus UI-Layer)
- Visibility-Dropdown: `'Nur DM'`, `'Öffentlich'`, `'Für den Spieler…'` — Deutsch
- Tab-Labels in Tests: Englisch (`'Overview'`) vs. Component: Deutsch (`'Übersicht'`) — gerade erst behoben, zeigt Regressionsgefahr

## Technische Besonderheit: Entity-Typ-Namen

Entity-Typen (`Character`, `Location` etc.) kommen aus `core_data/entity-type-schemas.ts` und System-Plugins — die sind sprachlich neutral (Schlüssel/IDs) und werden direkt als Display-Label verwendet. Das müsste separat übersetzt werden (eigenes `displayName`-Feld im Schema), unabhängig vom UI-String-Layer.

## Optionen (zur Diskussion, nicht entschieden)

| Ansatz | Aufwand | Tradeoff |
|---|---|---|
| **react-i18next / i18next** | Hoch (Migration ~170 Strings) | Industriestandard, Namespaces, Pluralformen, lazy load |
| **Eigener `t(key)`-Hook über Context** | Mittel | Weniger Dependencies, volle Kontrolle, kein Tooling |
| **JSON-Dateien pro Locale ohne Framework** | Niedrig initial | Skaliert schlecht, kein Pluralform-Support |

## Offene Fragen für den Requirements Engineer

1. Welche Sprachen sind das Ziel? (DE+EN als Minimum, weitere?)
2. Sind Entity-Typ-Namen Teil des i18n-Scopes oder bleibt das englisch als kanonische ID?
3. System-Plugin-Strings (kommen von extern/Nutzer-definiert) — in Scope oder explizit ausgenommen?
4. Priorisierung: Welche Bereiche zuerst? (z.B. WelcomeScreen + Navigation vor Editor-Details)
5. Fallback-Sprache bei fehlender Übersetzung?
