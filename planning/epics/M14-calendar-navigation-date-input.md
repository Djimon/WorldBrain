# EPIC-020: Kalender-Navigation & Datums-Eingabe (α)

**Milestone:** M14 — Calendar, Events & World State. **Kopplung:** liefert das geklemmte Datums-Widget für EPIC-021 (β) und die Ära-Eingabe; unabhängig baubar.

## Goal

Der DM kann gezielt und elegant durch die Zeit navigieren — auch in die (negative) Vergangenheit — statt nur `‹ Today ›`. Datums-Eingaben (Event- und Ära-Datum) sind gegen ungültige Tage/Monate geklemmt; nur das Jahr ist vorzeichenbehaftet und unbegrenzt.

## Bestandsaufnahme (heute)

- `CalendarMonthView`-Header: nur `‹` / `Today` / `›` (Monatsschritt) + Global/Ära-Umschalter. Kein Jahr-/Monats-Control.
- Der interne Counter ist bereits vorzeichenbehaftet (negative Tage projizieren korrekt) — die **UI zum Hinspringen** fehlt nur.
- Ära-Datums-Eingabe im `CalendarWizard` und (künftig) Event-Datum brauchen dieselbe Klemm-Logik.

## Decisions (verbatim in jede betroffene Story-AC)

1. **Header-Reihenfolge nach Granularität: Jahr > Monat > Today.**
2. **Jahr-Auswahl als Popout** (nicht dauerhaft sichtbar — selten genutzt, spart Platz): oben die **3 zuletzt besuchten Jahre** als Pills, darunter Schnellsprung `−5 / +5`, darunter Integer-Input + `Gehe zu Jahr`-Button. **Das Jahr ist das einzige vorzeichenbehaftete/unbegrenzte Feld** (darf negativ).
3. **Monats-Dropdown** listet die abgeleiteten Monate des aktiven Kalenders; Auswahl springt den Monat, Jahr bleibt.
4. **Datums-Eingabe klemmen:** Tag ∈ [1, Monatslänge], Monat ∈ [1, Monatszahl], Jahr ∈ ℤ. Verkürzt ein Monatswechsel das Tag-Maximum (Tag 31 → Monat mit 30 Tagen), **springt der Tag automatisch auf das Max (30) + einmaliger visueller Cue** (kurzes Aufblinken des Feldes). Kein Speichern-Block (ein geklemmter Wert ist nie ungültig). Als wiederverwendbares Widget `CalendarDateInput`, genutzt von **Event- und Ära-Datum**.
5. **Header-Layout:** Titel/Ära-Anzeige zentriert (bzw. nach rechts), damit die neuen Controls links Platz haben.

## Anti-Patterns (verbatim in AC der betroffenen Stories)

- **AP-001:** database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites.
- **AP-003:** No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API.
- **AP-008 (RTL):** All RTL name/text queries anchored (`^…$`) where labels share a prefix; no bare `|<fragment>` catch-all; `||`/`??` fallbacks use `queryBy*`; multi-match uses `getAllBy*`/`within`.

## Out of Scope

- Event-/Ära-Datenmodell (nur Navigation & Eingabe-Widget).
- Schaltjahre / variable Jahreslängen (weiterhin out; Widget darf die Monats-Definition aber nicht hart annehmen).

## Stories

### M14-S01: Jahr-Navigation als Popout
**Owner:** ui (CalendarMonthView-Header). **Ziel:** gezielter Jahr-Sprung, inkl. Vergangenheit.

**AC:**
- Ein Popout (nicht dauerhaft sichtbar) enthält: **3 zuletzt besuchte Jahre** als Pills (aktualisiert bei Navigation), Schnellsprung `−5 / +5`, Integer-Input + `Gehe zu Jahr`-Button.
- Das Jahr **darf negativ** sein (Sprung in die Vergangenheit); die Ansicht projiziert korrekt (Counter ist vorzeichenbehaftet).
- Auswahl/Eingabe setzt das View-Jahr; Monat bleibt.
- Kein `prompt()/alert()/confirm()` (AP-003).
- AP-001, AP-003, AP-008(RTL) in AC.
- Tests: `m14-s01-year-nav-popout` — `.dom.test.tsx`: `Gehe zu -50` setzt Jahr −50; Recent-Pills zeigen die letzten 3 Jahre; `+5` springt korrekt.

### M14-S02: Monats-Dropdown & Header-Reihenfolge/Layout
**Owner:** ui (CalendarMonthView-Header). **Ziel:** Monatswahl + granularitäts-geordneter, aufgeräumter Header.

**AC:**
- **Monats-Dropdown** listet die abgeleiteten Monate des aktiven Kalenders; Auswahl springt den Monat (Jahr bleibt).
- Header-Reihenfolge **Jahr > Monat > Today** (Decision 1); `‹ ›` bleiben als Monatsschritt.
- Titel/Ära-Anzeige zentriert/rechts (Decision 5), Global/Ära-Umschalter bleibt erreichbar.
- AP-001, AP-008(RTL) in AC.
- Tests: `m14-s02-month-dropdown-header` — `.dom.test.tsx`: Dropdown listet alle Monate; Auswahl setzt Monat; Reihenfolge Jahr-vor-Monat-vor-Today im DOM.

### M14-S03: Geklemmtes Datums-Widget `CalendarDateInput`
**Owner:** ui (wiederverwendbare Komponente). **Ziel:** ein Widget für alle y/m/d-Eingaben (Event + Ära).

**AC:**
- Widget mit Tag/Monat/Jahr-Feldern; Tag ∈ [1, Monatslänge des gewählten Monats], Monat ∈ [1, Monatszahl], Jahr ∈ ℤ (vorzeichenbehaftet, unbegrenzt) — Decision 4.
- **Auto-Snap:** verkürzt ein Monatswechsel das Tag-Maximum, springt der Tag auf das neue Max **+ einmaliger visueller Cue** (kurzes Aufblinken). Kein Speichern-Block; geklemmter Wert ist immer gültig.
- Nimmt die Monats-Definition als Prop (keine harte 12-Monats-/Längen-Annahme).
- Wird von Event-Datum (EPIC-021 S07/S04) und Ära-Datum (`CalendarWizard`) genutzt; letzteres auf das Widget umstellen.
- Kein `prompt()/alert()/confirm()` (AP-003).
- AP-001, AP-003, AP-008(RTL) in AC.
- Tests: `m14-s03-calendar-date-input` — Tag 31 dann Monat mit 30 → Tag snap auf 30 + Cue-Klasse; Jahr −7 akzeptiert; Monat 14 auf 12 geklemmt.

## Story Tracking

| Story | Prio | Titel | Issue |
|---|---|---|---|
| M14-S01 | p1 | Jahr-Navigation als Popout | #256 |
| M14-S02 | p1 | Monats-Dropdown & Header-Reihenfolge/Layout | #257 |
| M14-S03 | p1 | Geklemmtes Datums-Widget `CalendarDateInput` | #258 |

## Abhängigkeiten

- Unabhängig baubar. Liefert `CalendarDateInput` für EPIC-021 (β, Event-Datum) und stellt die Ära-Eingabe im `CalendarWizard` darauf um.
- Bestehend: `CalendarMonthView` (Header), `dateToCounter`/`dayToDate` (Projektion, negativ-fähig).
