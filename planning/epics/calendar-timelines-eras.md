# EPIC: Calendar Timelines, Years & Eras

**Ziel:** Aus dem heutigen Ein-Kalender-Wizard einen echten Zeit-Layer machen: mehrere Kalender als **Projektionen** über einer gemeinsamen internen Zeitachse, mit Jahreszahlen, benannten Äras und Umschalten zwischen Kalendern — ohne Events zu verschieben.

## Kern-Architektur (Interview-Entscheidung)

- **Ein systeminterner absoluter Tages-Counter ist die einzige Wahrheit.** Alle Events sind fest auf absoluten Tagen verankert (heute schon: `events.start_day`/`end_day`).
- **Jeder Kalender ist eine Projektion/Overlay**: er bildet einen absoluten Tag → `{Jahr, Monat, Tag}` ab, über seine `months_json`/`year_length_days` + einen **Epoch-Anker** (welcher absolute Tag = Referenzdatum des Kalenders).
- **Kalender umschalten = dieselben absoluten Tage neu projizieren.** Kein Umrechnen, kein Duplizieren von Events.
- **Cross-Kalender-Verknüpfung** (1.1.400 A = 5.9.6542 B) = beide Kalender auf denselben Counter ankern; der A↔B-Offset ergibt sich aus den Ankern.
- **Jahre:** globales Jahr aus der Projektion. **Äras:** benannte Bereiche über globale Jahre; Anzeige wahlweise global ODER ära-relativ („Jahr 5 der Furchung") — beides parallel gespeichert.

## Bestandsaufnahme (heute)

- `calendars`: `year_length_days`, `epoch_label`, `months_json`, `week_json`. Kein Epoch-Anker, keine Aktiv-Markierung, keine Äras-Labels.
- `eras`-Tabelle existiert (`starts_absolute_day`, `year_number_at_start`) — **ohne Name/Label, nirgends verdrahtet** (totes Gerüst).
- `dayToDate`/`dateToDay` existieren, aber `dayToDate` hat **Monat hartkodiert `1`** (keine Ableitung aus `months`), und **nichts** ist im Frontend verdrahtet.
- `CalendarMonthView` zeigt nur einen Monats-Index, **kein Jahr**.

## Anti-Patterns (verbatim in jede betroffene Story-AC)

- AP-001: `database`-Prop als `DatabaseLike` (aus `entity-service.ts`); keine `unknown`/`as never`-Casts.
- AP-006: Kein `try/catch` um DB-Operationen; Schema vor Nutzung anwenden, Fehler propagieren (Ausnahmen: `JSON.parse` von DB-Daten → sicherer Fallback).

## Stories

### S1 — Absolute-Tage-Fundament & Kalender-Projektion
**Owner:** data-model + calendar-service. **Status:** ready.
- **Interner Counter = vorzeichenbehaftete Achse ohne Boden.** Das bei Erstellung gewählte Startdatum („Welt beginnt bei 05.04.400") ist nur der **Epoch-Anker/Lesezeichen** (= absoluter Tag 0), **nicht** der Nullpunkt der Zeit. Vergangenheit = negative absolute Tage, Zukunft = positive.
- Kalender bekommt einen **Epoch-Anker** auf dem internen Counter. Feld an `calendars` ODER via `eras.starts_absolute_day` — in S1 festlegen.
- `dayToDate(calendar, absoluteDay)` leitet **Monat + Tag real aus `months`** ab (Bug `month:1` weg); `dateToDay` invers. Round-trip-stabil **auch für negative Tage** (floor-Division/Modulo, nicht JS-`%`).
- Events bleiben unverändert auf absoluten Tagen.
- **AC:** Gegeben Kalender mit Monaten [30,30,…] und Epoch-Anker: absoluter Tag D (inkl. **D < 0**) → korrektes `{Jahr, Monat, Tag}`; `dateToDay(dayToDate(D)) === D` für positive UND negative D; Tag vor Anker → Vortag, ein Jahr zurück → Vorjahr. Jahr aus globaler Zählung. AP-001 + AP-006 in AC.
- Tests: `m<>-s01-calendar-projection` (inkl. Negativ-/Vor-Epoch-Fälle).

### S2 — Jahr-/Monatsanzeige in der Monatsansicht
**Owner:** ui (CalendarMonthView). **Blocked by:** S1.
- Monatsansicht zeigt **Jahr + abgeleiteten Monatsnamen** für das dargestellte Tages-Fenster; Navigation rollt korrekt über Jahresgrenzen.
- **AC:** Header zeigt „Monatsname Jahr"; „>" am Jahresende erhöht das Jahr; Tageszahlen entsprechen der Projektion, nicht mehr stur 1..n.

### S3 — Äras (Label-Bereiche, global + relativ)
**Owner:** data-model + ui. **Blocked by:** S1.
- Ära-Modell: `name` + Start (globales Jahr / absoluter Tag) [+ Ende abgeleitet aus nächster Ära]; zusammenhängende Bereiche. `eras`-Tabelle um `name` + Label-Semantik erweitern (totes Gerüst nutzbar machen).
- Anzeige-Umschalter: global („Jahr 400") vs. ära-relativ („Jahr 5 der Furchung"). Beides gespeichert/ableitbar.
- CRUD im Wizard.
- **AC:** Äras 0–400 „Ära der Grah", 401–1200 „Furchung" definieren → Datum zeigt korrektes Ära-Label; ära-relatives Jahr korrekt berechnet.

### S4 — Kalender-Picker / aktiver Anzeige-Kalender
**Owner:** ui + kleine Persistenz. **Blocked by:** S1.
- Liste aller Kalender; Auswahl welcher **angezeigt** wird. Events unverändert (nur neu projiziert). Auswahl projektweit persistiert (Flag an `calendars` ODER App-Setting — in S4 festlegen).
- **AC:** 2 Kalender → umschalten → dieselben Events erscheinen neu projiziert, keine Duplikate, keine Event-Änderung in der DB.

### S5 — Cross-Kalender-Verknüpfung
**Owner:** data-model + ui. **Blocked by:** S1, S4.
- **Frontend nur Kalender↔Kalender:** Nutzer gibt die Äquivalenz in Kalender-Datumsangaben ein (1.1.400 A = 5.9.6542 B). Der interne Counter wird dem Nutzer **nie gezeigt**.
- **Speicherung = pro Kalender der Epoch-Anker auf dem gemeinsamen Counter** (aus `epoch_anchor_day`, S1), NICHT eine gerichtete A→B-Regel. Die eingegebene Äquivalenz kalibriert den Anker des verknüpften Kalenders relativ zum ersten.
- Dadurch **bidirektional und n-fach** von selbst: A→B ist das negierte Offset von B→A; jeder Kalender ↔ jeder umrechenbar; freies Hin-/Her-Wechseln.
- **AC:** Äquivalenz eingeben → beliebiges A-Datum zeigt korrektes B-Datum UND umgekehrt (B→A), ohne dass der interne Counter im UI auftaucht; kein Sonderfall/gerichtete Regel gespeichert.

## Offene Entscheidungen

1. ~~**Vor-Epoch / negative Tage**~~ **ENTSCHIEDEN:** Counter ist vorzeichenbehaftet. Das bei Erstellung gewählte Startdatum ist der Epoch-Anker (Tag 0), **nicht** der Boden. Vergangenheits-Lore/Events = negative absolute Tage. Projektion muss floor-Division/Modulo nutzen. (Erstellungs-Startdatum-Wahl kommt als UI in die Wizard-Story.)
2. **Schaltjahre / unregelmäßige Jahre:** V1 out of scope (festes `year_length_days`). Sollten wir vlt schon mit dneken/vorberieten dmait wir usn da später ncihts verbauen. acuh sowas wie altenreirende jahreslängen kann ich mir vorstellen.
3. **Persistenz aktiver Kalender:** Flag an `calendars` vs. App-Setting → S4.
4. **Epoch-Anker-Ablage:** neues Feld an `calendars` ('epoch_anchor_day')
## Blocker

Keine harten. S2–S5 hängen an S1 (Projektions-Fundament).
