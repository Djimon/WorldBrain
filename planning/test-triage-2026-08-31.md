# Test-Triage — 332 vitest-Fails (Stand 2026-08-31)

Basis: `vitest run` → **PASS 2227 / FAIL 332 / 0 skipped**, verteilt auf **51 Dateien**.
(Die ~10 Fails zur Nutzer-Baseline „342" stammen aus den statischen `node --test tests/*.test.mjs`, hier nicht enthalten.)

Abgleich mit GitHub: **nur 9 offene Issues** (`Djimon/WorldBrain`). Alles andere betrifft
geliefert/geschlossene Features → Fail = Test veraltet, nicht Feature kaputt.

## Verdikt-Legende
- 🔵 **ZUKUNFT** — offenes Issue, TDD-Test wartet auf Implementierung. **Nicht anfassen.**
- 🟢 **FIX** — Feature lebt, nur der Test ist veraltet (Async-Mock / Harness / Seed-Text). Anpassen.
- 🟡 **TRIM** — Datei behalten, aber veraltete Einzel-Assertions entfernen/umbiegen (Rest ist gültiger Guard).
- 🔴 **DELETE** — ersatzlos löschbar (Gegenstand per Entscheidung entfernt, kein Restwert).

---

## 🔵 ZUKUNFT — offene Issues, nicht anfassen (32 Fails)

| Datei | Fails | Issue | Grund |
|---|---|---|---|
| m17-s01-brand-registry.test.ts | 6 | #381 (open, ready) | `src/branding/brand.ts` existiert nicht — M17 ungebaut. |
| m17-s02-header-identity.dom.test.tsx | 4 | #383 (open, ready) | Header-Identitätsleiste (`brand.platform`/„Worlds and Beyond") ungebaut. |
| m17-s03-mode-accent-tokens.test.ts | 8 | #382 (open, p1) | `--mode-accent`-Token-System fehlt. |
| m17-s04-theme-registry.test.ts | 10 | #385 (open, ready) | Modul `src/styles/theme-registry` fehlt. |
| m17-s05-engine-brand.dom.test.tsx | 3 | #384 (open, ready) | Engine-Marke (`brand.engine`/„RuleLoom") ungebaut. |
| m10-dbless-join-handshake.test.ts | 1 | #387 (open, p0) | **Aktives WIP** (in git status modified). |

---

## 🟢 FIX / Cluster B — Async-Mock-Drift (~135 Fails, rein mechanisch)

**Ursache (verifiziert):** Services sind auf `async`/`Promise` migriert
(`listEntitiesByType`, `getRelations`, `listSnapshots`, `readAppConfig`, `validateProjectZip` …).
Die DOM-Tests mocken sie noch **synchron** (`vi.fn(() => [...])`), die Produktions-Komponente
ruft aber `.then(...)` → `TypeError: (...).then is not a function`.
**Fix pro Datei:** Mocks auf `mockResolvedValue` / `async` umstellen (+ ggf. `await`/`waitFor`).

| Datei | Fails | Betroffene Komponente |
|---|---|---|
| m2-s12-relations-tab.dom.test.tsx | 28 | RelationsTab (`getRelations`) |
| m2-s11-entity-picker.dom.test.tsx | 20 | EntityPicker (`listEntitiesByType`) |
| m4-s07-capture-inbox.dom.test.tsx | 13 | CaptureInbox |
| m5-s19-card-instance-preview.dom.test.tsx | 12 | Card-Preview |
| m5-s20-print-sheet-composer.dom.test.tsx | 11 | PrintSheetComposer |
| m7-s04-snapshots.dom.test.tsx | 11 | SnapshotManager (`listSnapshots`) |
| m5-s07-session-clock.dom.test.tsx | 10 | SessionClock |
| m6-s09-dm-screen-dashboard.dom.test.tsx | 10 | DmScreen |
| m5-s10-map-viewer.dom.test.tsx | 8 | MapViewer |
| m7-s02-welcome-screen.dom.test.tsx | 7 | WelcomeScreen (`readAppConfig`) |
| m7-s06-zip-import.dom.test.tsx | 5 | ZipImportDialog (`validateProjectZip`) |

---

## 🟢 FIX / Cluster C — DB-/Schema-Harness-Drift (~74 Fails)

**Ursache:** Test-eigenes Setup (`openPopulatedDb`, Schema-Anwendung) ist nicht mehr deckungsgleich
mit Prod (Tabelle/Spalten fehlen, oder sync↔async gemischt: `expected Promise{} to be …`).
Feature lebt (`core_data/relations-schema.ts`, `relation-service.ts` etc.).
**Fix:** Harness an aktuelles Schema / Async-Signatur angleichen. Einzelne genauer prüfen.

| Datei | Fails | Symptom |
|---|---|---|
| m2-s10-relation-service.test.ts | 22 | `no such table: relations` — Setup baut Tabelle nicht mehr. |
| m4-s02-session-variable-system.test.ts | 13 | `expected undefined to be true` — API-Signatur gedriftet. |
| m4-s06-session-undo.test.ts | 11 | `expected Promise{} to be false` — sync↔async. |
| m2-s08-relations-schema.test.ts | 8 | `expected [] to include 'id'` — Schema-Introspektion leer. |
| m3-s05-saved-views.test.ts | 7 | Count-Mismatch (`+0` statt `1`). |
| m15-s05-map-folders.test.ts | 4 | Spaltenreihenfolge inkl. neuer `color`-Spalte. |
| m13-s02-overlay-plugin.test.ts | 3 | `expected false to be true`. |
| m5-s23-handout-model.test.ts | 3 | `expected Promise{} to have property "id"` — async. |
| m6-s04-plugin-entity-relation-types.test.ts | 2 | `expected 0 to be greater than 0`. |
| m5-s18-card-template-schema.test.ts | 1 | `expected +0 to be 9`. |

---

## 🟢 FIX / Cluster D — UI-/Seed-Text-Drift (~58 Fails, einzeln prüfen)

**Ursache:** Text/Rolle nicht gefunden — Seed-Namen umbenannt („Ada Thorn"/„Aria Windrunner"),
i18n-Labels (DE) geändert, oder Tab-/Button-Beschriftung migriert.
**Fix:** Erwartungswert an aktuelle UI-Sprache/Seed nachziehen.
⚠️ **Achtung:** Einzelne könnten „Komponente nicht gemountet" sein (echter P0) — pro Datei kurz prüfen,
bevor pauschal der Erwartungstext geändert wird.

| Datei | Fails | Gesuchter Text/Rolle |
|---|---|---|
| m5-s02-calendar-wizard.dom.test.tsx | 13 | „year length / step 1" |
| m3-s03-global-search-ux.dom.test.tsx | 8 | Seed „Ada Thorn" |
| m9-s03-player-character.dom.test.tsx | 8 | Seed „Aria Windrunner" |
| m2-s06-entity-detail-view.dom.test.tsx | 6 | Tab „Übersicht" |
| m5-s08-encounter-counters.dom.test.tsx | 6 | Button „next round / advance round" |
| m3-s04-table-view.dom.test.tsx | 5 | Seed „Ada Thorn" |
| m7-s03-new-project.dom.test.tsx | 4 | Textbox „Projektname / project name" |
| m15-s05-map-folder-tree.dom.test.tsx | 3 | Button „löschen" |
| m4-s09-player-screen.dom.test.tsx | 2 | „Public content." |
| m5-s16-map-embed-block.dom.test.tsx | 2 | „World Map" |
| m14-s06-day-click-creates-event.dom.test.tsx | 1 | `null.disabled` — Element nicht da. |

---

## 🟡 TRIM — Datei behalten, tote Assertions entfernen (~9 Fails)

> ⚠️ **Achtung — entscheidungs-getrieben (AGENTS: Test Conflict Stop Rule):**
> `issue-65` (Typ `WritableDatabaseLike`) und `issue-107` (Datei `GridOverlay.tsx.deprecated`)
> testen bewusst getroffene Design-/Aufräum-Entscheidungen. Bevor hier Assertions entfernt werden,
> muss bestätigt sein, dass die Entfernung des Typs bzw. das endgültige Löschen der Datei
> **beabsichtigt** war → sonst `NEEDS_DECISION`, **kein stiller Test-Edit**.
> (`m2-s03` und `m11-s04` sind dagegen reine Test-Bugs/Pfad-Drift und dürfen direkt gefixt werden.)

| Datei | Fails | Was ist tot | Was bleibt gültig |
|---|---|---|---|
| issue-107-no-react-leaflet.test.ts | 2 | 2× Lesen von `GridOverlay.tsx.deprecated` (Datei endgültig gelöscht). | react-leaflet-Guard auf MapViewer/MapEmbedBlock/package.json/GridLayer — **weiter wertvoll**. |
| issue-65-writable-database-type.test.ts | 3 | Verlangt Typnamen `WritableDatabaseLike` — **bewusst abgeschafft** (Konsolidierung auf `DatabaseLike`). | „kein lokaler `WriteDb`-Typ" + Runtime-Checks addRelation/getRelations. |
| m11-s04-ui-map-session-strings.test.ts | 2 | Eintrag `MapMarkers.tsx` (ersetzt durch `MapTokenLayer.tsx`). | Restliche i18n-Migrationsprüfung. |
| m2-s03-block-conversion.test.ts | 2 | `readFileSync is not defined` — **fehlender Import im Test** (reiner Test-Bug). | Ganze issue-32-Sektion, nach Import-Fix. |

---

## 🟢 FIX / Einzelfälle — Pfad/Async (~7 Fails)

| Datei | Fails | Grund | Fix |
|---|---|---|---|
| issue-142-dm-screen-service-stubs.test.ts | 4 | Import `core_data/dm-screen-schema` fehlt — `applyDmScreenSchema` liegt jetzt im Service (async). | Import-Pfad + `await` nachziehen. |
| m7-s07-tauri-build.test.ts | 3 | `expected undefined to be truthy` — prüft Build-Artefakte, evtl. env-abhängig. | Prüfen ob env-Skip nötig. |
| m15-s13-youtube-tier.dom.test.tsx | 2 | `expected '' to be 'none'` — CSS/Attr-Drift. | Erwartungswert. |
| m15-spotify-tier.dom.test.tsx | 2 | dito. | Erwartungswert. |
| issue-114-ap001-database-as-never.dom.test.tsx | 1 | `rebuildSearchIndex` nicht gemockt. | Mock ergänzen. |
| m11-s01-i18n-foundation.test.ts | 1 | `expected ['en'] to be 'en'` — API gibt Array. | Assertion. |
| m15-s16-clip-editor.dom.test.tsx | 1 | STACK_TRACE_ERROR (Render-Crash). | Genauer prüfen. |
| mi-s00-tauri-plugin-migration.test.ts | 1 | `EISDIR` — ein Service-Pfad ist jetzt ein Verzeichnis. | Pfad auf index umbiegen. |

---

## Zusammenfassung

| Bucket | Dateien | ~Fails | Aktion |
|---|---|---|---|
| 🔵 ZUKUNFT | 6 | 32 | Nicht anfassen (M17 #381–385, M10 #387). |
| 🟢 FIX B (async-Mock) | 11 | ~135 | Mechanisch, größter Schnellgewinn. |
| 🟢 FIX C (DB-Harness) | 10 | ~74 | Harness angleichen. |
| 🟢 FIX D (UI/Seed) | 11 | ~58 | Erwartungstext nachziehen (Mount-Check!). |
| 🟢 FIX Einzelfälle | 8 | ~15 | Pfad/Async/Mock. |
| 🟡 TRIM | 4 | ~9 | Tote Assertions raus. |

**Ersatzlos komplett löschbare *Dateien*: 0** — überall steckt Restwert; „Wegwerfen" heißt hier
**Trimmen** (Cluster 🟡), nicht Datei-Delete.
