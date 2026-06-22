# 03 Time And State Model

## Goal

Zeit darf nicht nur eine Textnotiz sein. In einem guten Worldbuilding-Tool kann man fragen:

- Was ist am 13. Tag des Sturmmonds passiert?
- Welche NPCs waren zu diesem Zeitpunkt an welchem Ort?
- Welche Quest war damals aktiv?
- Welche Fraktion wusste welches Geheimnis?
- Wie sah die Karte vor dem Krieg aus?

ChronoGrapher ist konzeptionell spannend, weil dort History nicht nur ein Artikeltyp ist, sondern Weltzustand beeinflussen kann.

## Core Principle

Intern sollte Zeit als abstrakter Zeitstrahl gespeichert werden. Kalender sind nur Darstellungen.

```text
Absolute Tick -> Calendar Projection -> User-facing Date
```

Beispiel:

```json
{
  "absolute_day": 184233,
  "calendar_id": "cal_faerun_custom",
  "display": "17. Kythorn, Year of Three Ships"
}
```

## Why This Matters

Wenn jeder Kalender direkt als String gespeichert wird, sind Vergleiche schwer:

- "vorher/nachher"
- Dauer
- parallele Timelines
- Altersberechnung
- wiederkehrende Events
- Mondphasen
- Jahreszeiten

Eine absolute interne Achse loest das.

## Calendar Model

```json
{
  "id": "cal_simple_fantasy",
  "title": "Simple Fantasy Calendar",
  "epoch_label": "Founding",
  "year_length_days": 360,
  "week": {
    "days": ["Moonday", "Tidesday", "Windsday", "Firesday", "Starday"]
  },
  "months": [
    {"name": "First Seed", "length_days": 30},
    {"name": "High Sun", "length_days": 30}
  ],
  "day_length_hours": 24,
  "night_cycle_length_hours": 6,
  "intercalary_days": [],
  "eras": [],
  "moons": [],
  "seasons": []
}
```

## Avoid Calendar Configuration Hell

Der User darf nicht gezwungen sein, eine halbe Astronomie-Simulation zu bauen.

Empfohlene UX:

1. Preset waehlen.
2. Grobe Fragen beantworten.
3. Erweiterte Details optional.
4. Kalender jederzeit spaeter verfeinern.

### Preset Types

| Preset | Beschreibung |
|---|---|
| Earth-like | 365 Tage, 12 Monate, 7 Tage Woche |
| Simple fantasy | 360 Tage, 12 Monate je 30 Tage |
| Short year | z.B. 253 Tage |
| Lunar | Monate folgen Mondzyklen |
| Weird but playable | Custom months + simple seasons |
| Imported | aus Plugin/JSON |

## Calendar Wizard

Statt 40 Feldern:

```text
Wie lang ist ein Jahr?
[ ] Wie Erde
[ ] 360 Tage
[ ] Eigene Laenge: ___ Tage

Wie komplex sollen Monate sein?
[ ] Egal, Tool macht Standard
[ ] gleich lange Monate
[ ] unterschiedliche Monate

Braucht die Welt Monde?
[ ] Nein
[ ] 1 Mond
[ ] mehrere Monde

Braucht die Welt Jahreszeiten?
[ ] Nein
[ ] Standard 4
[ ] eigene
```

## Eras

Eras sind Anzeige-Offsets auf derselben Zeitachse.

```json
{
  "id": "era_7th_age",
  "calendar_id": "cal_world",
  "label": "7th Age",
  "starts_absolute_day": 180000,
  "year_number_at_start": 1
}
```

Das erlaubt:

- Jahr 27527 global
- gleichzeitig Jahr 398 der 7th Age

## Events

```json
{
  "id": "event_fall_of_the_gate",
  "type": "historical_event",
  "title": "Fall of the Gate",
  "time": {
    "start_day": 184200,
    "end_day": 184203,
    "precision": "day"
  },
  "participants": ["faction_sunspears", "npc_jadoth"],
  "location_id": "loc_desolation_gate",
  "visibility": {
    "default": "gm_only"
  }
}
```

Precision sollte flexibel sein:

| Precision | Use Case |
|---|---|
| exact_minute | Session clock, infiltration |
| hour | travel, ritual |
| day | campaign events |
| month | politics |
| year | history |
| vague | legends |

## Timeline Views

| View | Use Case |
|---|---|
| Chronicle | lesbare Ereignisfolge |
| Gantt | lange Konflikte, parallele Plots |
| Calendar | Sessionplanung |
| Causal Graph | Ursache/Wirkung |
| Location Timeline | Was passierte an einem Ort? |
| Character Timeline | Wo war dieser NPC wann? |

## World State At Time X

Das ist der hohe Wert.

Statt nur Events zu speichern, kann man State Changes speichern:

```json
{
  "id": "statechange_gate_destroyed",
  "effective_from": 184203,
  "target_entity_id": "loc_desolation_gate",
  "property_changes": {
    "status": "destroyed",
    "accessibility": "closed"
  },
  "caused_by_event_id": "event_fall_of_the_gate"
}
```

Query:

```text
Get entity state as of absolute_day = 184250
```

System berechnet:

- Basis-Entity
- alle StateChanges bis Zeitpunkt X
- daraus sichtbarer Zustand

## Session Time

Session-Zeit ist nicht Weltzeit.

```json
{
  "session_id": "sess_42",
  "world_time_start": 184250,
  "session_clock": {
    "mode": "manual",
    "elapsed_minutes": 0
  }
}
```

Man braucht beides:

- Weltzeit: "2 Tage spaeter"
- Session-Zeit: "nach 3 Runden oeffnet sich die Tuer"

## Repeating Events

Fuer wiederkehrende Events kann man sich an iCalendar/RRULE-artigen Konzepten orientieren, aber fuer Fantasy vereinfachen.

```json
{
  "recurrence": {
    "type": "monthly",
    "month_day": 13,
    "calendar_id": "cal_world",
    "until_day": 190000
  }
}
```

Komplexe RRULEs sind fuer V1 wahrscheinlich zu technisch. Besser:

- daily
- weekly
- monthly
- yearly
- every_n_days
- moon_phase
- custom condition

## Decision Questions

1. Soll das Tool absolute Zeit in Tagen oder Sekunden/Ticks speichern? Tagen -> Sekunde/Uhrzeiten nur bie Events als einzenles
2. Braucht V1 Minuten/Runden oder reicht Tagesgenauigkeit plus Session Timer? --> mindestens Runden als optionale Counter einschaltbar, der wenn er an ist automatisch neue events den Counter mitgibt beim speichern
3. Sollen mehrere Kalender dieselbe absolute Timeline projizieren? -> ja, optional. ählnich wie epochen nur halt parallele zeitrechnungen
4. Braucht V1 State-at-Time oder nur Events? --> nein eher rein event-getrieben und Events ändern gliblae oder session-Variablen (als state-ersatz), aber Datenseitig gern schon mitdenken
5. Soll ein Event mehrere Locations haben duerfen? -> Ja Events habne Liste von Locations mit optionaler primary location
6. Sollen Kalender als Plugin importierbar sein? --> Definitiv Import- udn Export funktion!

## Recommendation

Fuer V1:

- interne absolute Zeitachse in Minuten oder Tagen plus optionaler Precision.
- Kalender als Projektion, nicht als Wahrheit.
- Preset Wizard statt blankem Kalenderformular.
- Events mit Teilnehmern, Location, Visibility.
- StateChange-Modell wenigstens vorbereiten.
- Session Clock getrennt von World Time.

## Sources

- Kanka calendars: https://docs.kanka.io/en/latest/entries/calendars.html
- Fantasy Calendar engine: https://fantasy-calendar.com/
- Aeon Timeline custom calendars: https://help.aeontimeline.com/article/60-custom-fantasy-calendars
- ChronoGrapher concept: https://chronographer.net/Info
- USNO calendar basics: https://aa.usno.navy.mil/faq/calendars
