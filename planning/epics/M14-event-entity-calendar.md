# EPIC-021: Event-Entity & Kalender-Integration (β)

**Milestone:** M14 — Calendar, Events & World State. **Kopplung:** M5 (time-events-world-state-light), EPIC-020 (α, Datums-Widget), EPIC-022 (γ, Effekte).

## Goal

„Ereignis" wird **eine** Sache: eine generische `Event`-Entity, die zusätzlich ein Datum auf dem internen Counter trägt. Die heutige parallele `events`-Tabelle (`event-schema.ts`/`event-service.ts`) wird aufgelöst. Der Klick auf einen Kalendertag öffnet **dasselbe** Entity-Erstell-Formular wie das Entity-Menü, nur mit vorbelegtem Datum. Body/Description, Verknüpfungen und Sichtbarkeit kommen aus dem Entity-System; `event_kind`, Datum und `effects` sind event-spezifische Zusatzfelder.

## Decisions (verbatim in jede betroffene Story-AC)

1. **Ereignis = generische `Event`-Entity** (`base_entities`, `type='Event'`) — KEIN Parallel-Objekt. Die `events`-Tabelle + `event-service.ts` werden abgelöst. Dev-Daten sind wegwerfbar; **kein Backward-Compat / kein Dual-Format**.
2. **Event-spezifische Daten liegen in `properties`** (BaseEntity-JSON) unter festen Keys: `event_kind` (`'single' | 'phase'`), `start_day` (Integer, Counter-Tag, **darf negativ sein**), `end_day` (Integer | weggelassen; nur bei `phase`), `effects` (Array — Inhalt definiert EPIC-022 γ; β legt nur das Feld als leeres Array an). Name = `title`, Description = `body` (`portable_blocks_v1`), Sichtbarkeit = `visibility`.
3. **participants / locations = Relationen** (`relations`-Tabelle), feste Typen: `event_has_participant` (inverse `participant_in`) und `event_at_location` (inverse `location_of`). Im Formular als Autofill-**Pill**-Felder: Entities eintippen → bestätigen → als Pill; die Relation wird angelegt. Kein manuelles Relation-Anlegen nötig.
4. **Der Kalender lädt `Event`-Entities**, liest `start_day`/`end_day` aus `properties` und filtert das sichtbare Fenster **in JS** (wie die heutige `CalendarMonthView` alle Events lädt und filtert). Keine neue Index-Struktur in V1.
5. **Tag-Klick → Standard-Entity-Erstell-Formular** (dasselbe wie im Entity-Menü) mit aus dem geklickten Counter-Tag **vorbelegtem** `start_day`; `event_kind` default `'single'`.
6. **`precision` entfällt** (geht in `event_kind` auf; eine konkrete Uhrzeit schreibt der DM als Plaintext in den Body).
7. **`visibility` setzt der DM im Erstell-Formular.** Verlinkte Entities erben nichts. Spieler-spezifische Kalender-Filterung ist **out of scope** (Session-Modus, später).
8. **Event-Kategorie = thematisch, optional, erweiterbar** (`properties.category`, freier String). Ersetzt die alte, gemischte `type`-Taxonomie. Seed-Vorschläge cross-genre: `battle`, `politics`, `disaster`, `discovery`, `ritual`, `investigation`, `social`, `death` — DM-erweiterbar, kein Enum-Zwang. **Provenienz** (authored vs. session) ist NICHT die Kategorie; sie kommt später automatisch mit dem Session-Modus. Realisiert in M14-S15 (#272, da #259 closed). ChronicleView filtert nach `category`; `precision`/`vague` fällt weg.

## Anti-Patterns (verbatim in AC der betroffenen Stories)

- **AP-001:** database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites.
- **AP-003:** No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API.
- **AP-006:** No `try/catch` around DB operations; errors propagate to the caller (Ausnahme: `JSON.parse` von `properties`/DB-Daten → sicherer Fallback).
- **AP-008 (RTL):** All RTL name/text queries anchored (`^…$`) where labels share a prefix; no bare `|<fragment>` catch-all; `||`/`??` fallbacks use `queryBy*`; multi-match uses `getAllBy*`/`within`.
- **AP-008 (prop-gate):** No `if (database)` / `if (service)` guards before service calls; optional props passed through unconditionally.

## Out of Scope

- Effekt-/Folgen-Semantik & World-State (= EPIC-022 γ; β legt nur `effects: []` an).
- Navigations-UX & geklemmtes Datums-Widget (= EPIC-020 α; β konsumiert das Widget).
- Spieler-spezifische Sichtbarkeits-Filterung (Session-Modus).
- Schaltjahre / variable Jahreslängen (M5-Kalender-Entscheidung, weiterhin out).
- **Undatierte Events / Gerücht / Prophezeiung:** ein Event hat **zwingend** ein `start_day` (Interview-Entscheidung). Undatierte, epistemisch unsichere Inhalte (Gerücht, Prophezeiung) sind KEINE Events → künftiges eigenes **Lore-Entity-Konzept** (Typen story/backstory/readout/secret/prophecy/rumor…), separat gespect. Die alten ChronicleView-`type`-Werte `rumor`/`prophecy` wandern dorthin, nicht ins Event-Modell.

## Stories

### M14-S04: Event-Entity-Modell & Ablösung der events-Tabelle
**Owner:** data-model. **Ziel:** `Event` als generische Entity mit event-spezifischen `properties`; alte `events`-Tabelle/`event-service` weg.

**AC:**
- Eine `Event`-Entity ist eine `base_entities`-Zeile mit `type='Event'`. Event-Daten liegen in `properties`: `event_kind` (`'single'|'phase'`), `start_day` (Integer, darf negativ), `end_day` (Integer, nur bei `phase`), `effects` (Array, in β immer `[]`).
- Ein Service-Modul (Ersatz für `event-service.ts`) bietet: Event-Entity anlegen (mit `start_day`, `event_kind`, optional `end_day`), auflisten, lesen, aktualisieren — **über `base_entities`**, nicht über eine `events`-Tabelle.
- Die `events`-Tabelle (`event-schema.ts`) und `event-service.ts` werden entfernt; kein Dual-Format, keine Migrations-Kompatibilitätsschicht (Decision 1).
- `start_day`/`end_day` werden als Zahlen in `properties` gespeichert und beim Lesen sicher geparst (`JSON.parse`-Fallback erlaubt, AP-006).
- AP-001, AP-006 in AC.
- Tests: `m14-s04-event-entity` — anlegen/lesen mit negativem `start_day`; `phase` mit `end_day`; `single` ohne `end_day`.

### M14-S05: Kalender rendert Event-Entities
**Owner:** ui (CalendarMonthView). **Blocked by:** M14-S04. **Ziel:** Monatsansicht liest Events aus dem Entity-System statt aus `event-service`.

**AC:**
- `CalendarMonthView` lädt `Event`-Entities (S04-Service) statt `listEvents` aus `event-service`; `start_day`/`end_day` kommen aus `properties`.
- Rendering unverändert: Events erscheinen in den Zellen des Counter-Tages; Phasen (`end_day`) über ihren Bereich; Projektion/Anker wie bisher (`dateToCounter`).
- Keine `events`-Tabellen-Referenz mehr im UI.
- AP-001, AP-008(RTL) in AC.
- Tests: `m14-s05-calendar-renders-events` — Event an Counter-Tag erscheint in der richtigen Zelle; Phase erstreckt sich über Tage; kein Bezug auf `events`-Tabelle.

### M14-S06: Tag-Klick → Event-Erstellung mit vorbelegtem Datum
**Owner:** ui (WorkspaceShell + CalendarMonthView Verdrahtung). **Blocked by:** M14-S04. **Ziel:** Der lose `onCreateEvent`-Draht wird an das Standard-Entity-Erstell-Formular gehängt.

**AC:**
- `WorkspaceShell` reicht `onCreateEvent(counterDay)` an `CalendarMonthView` durch (heute fehlt der Prop).
- Klick auf eine Tageszelle öffnet **dasselbe Entity-Erstell-Formular wie das Entity-Menü** für `type='Event'`, mit `start_day` = geklicktem Counter-Tag vorbelegt, `event_kind='single'`.
- Nach Speichern erscheint das Event ohne Reload in der Ansicht (Liste neu geladen).
- Kein `prompt()/alert()/confirm()` (AP-003); Formular ist gerendertes React-UI.
- AP-001, AP-003, AP-008(RTL), AP-008(prop-gate) in AC.
- Tests: `m14-s06-day-click-creates-event` — `.dom.test.tsx`: Klick auf Tag rendert das Event-Formular mit vorbelegtem Datum; Speichern legt eine `Event`-Entity mit passendem `start_day` an.

### M14-S07: Event-Formular — Zusatzfelder (kind, participants/locations, visibility)
**Owner:** ui (Event-Formular). **Blocked by:** M14-S04, M14-S06. **Ziel:** Die event-spezifischen Felder im Erstell-/Bearbeiten-Formular.

**AC:**
- **`event_kind`-Umschalter** (Einzelevent | Phase). Bei `phase` erscheint ein `end_day`-Datumsfeld (nutzt das geklemmte Datums-Widget aus EPIC-020 α, sonst einfaches Feld); `end_day ≥ start_day` erzwungen.
- **participants**: Autofill-Pill-Feld — Entity eintippen, bestätigen → Pill; legt Relation `event_has_participant` an. Mehrere möglich; Pill entfernen löst Relation.
- **locations**: Autofill-Pill-Feld analog mit `event_at_location`.
- **visibility**: Auswahl (`public` / `gm_only` / …) am Event (= Entity-`visibility`); DM setzt sie hier.
- Name (`title`), Description (`body`) kommen aus dem Standard-Entity-Formular (nicht neu bauen).
- `effects`-Feld wird als leeres Array angelegt/durchgereicht (Editor = γ, hier nur Platzhalter/kein UI).
- Kein `prompt()/alert()/confirm()` (AP-003).
- AP-001, AP-003, AP-008(RTL) in AC.
- Tests: `m14-s07-event-form-fields` — `.dom.test.tsx`: kind-Umschalter zeigt/versteckt `end_day`; participant-Pill legt Relation an; visibility-Auswahl schreibt `visibility`.

### M14-S15: Event-Kategorie (thematisch, erweiterbar)
**Owner:** data-model + ui. **Erweitert #259 (closed).** **Ziel:** optionales thematisches `category`-Feld für den Chronicle-Filter.

**AC:**
- `event-entity-service.ts`: `properties.category?: string` (optional) durch `CreateEventEntityParams`/`EventEntitySummary`/`parse`/`toProperties`; fehlt/leer ⇒ `undefined`.
- Exportierte Konstante `EVENT_CATEGORY_SUGGESTIONS` = `[battle, politics, disaster, discovery, ritual, investigation, social, death]`.
- Event-Formular (M14-S07): Kategorie-Feld — Auswahl aus Vorschlägen **oder** Freitext; schreibt `properties.category`.
- Kein DB-Enum-Zwang (freier String).
- AP-001, AP-006 in AC.
- Tests `m14-s15-event-category`: create mit `category` gelesen; ohne → `undefined`; Suggestions-Länge 8.

## Story Tracking

| Story | Prio | Titel | Issue |
|---|---|---|---|
| M14-S04 | p0 | Event-Entity-Modell & Ablösung der events-Tabelle | #259 |
| M14-S05 | p0 | Kalender rendert Event-Entities | #260 |
| M14-S06 | p0 | Tag-Klick → Event-Erstellung mit vorbelegtem Datum | #261 |
| M14-S07 | p1 | Event-Formular — Zusatzfelder (kind, participants/locations, visibility) | #262 |
| M14-S15 | p1 | Event-Kategorie (thematisch, erweiterbar) | #272 |

## Abhängigkeiten

- **EPIC-020 (α):** geklemmtes Datums-Widget für `end_day` (S07) — β nutzt es, kann aber mit einfachem Feld starten.
- **EPIC-022 (γ):** konsumiert `properties.effects`; β legt das Feld nur an.
- **Bestehend:** `base_entities`/`base-json-serialization` (Entity-Shape), `relations`-Schema (participants/locations), `CalendarMonthView`/`dateToCounter` (Projektion).
