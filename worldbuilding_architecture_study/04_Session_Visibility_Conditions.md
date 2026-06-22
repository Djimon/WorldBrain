# 04 Session Visibility Conditions

## Goal

Secrets, Player View und Session Notes sind zentrale PnP-Features. Sie duerfen nicht spaeter angeklebt werden.

Der wichtige Gedanke:

> Session Notes sollten moeglichst wenig Lore duplizieren. Sie sollten Core-Lore einbetten, filtern und mit Sichtbarkeitsbedingungen versehen.

## Visibility Scopes

| Scope | Bedeutung |
|---|---|
| public | darf jeder sehen |
| gm_only | nur GM |
| player_known | Spieler haben es bereits erfahren |
| Player_specific | ein einzelner Spieler hat das Wissen (oder Liste) |
| discovered | wurde in der Kampagne entdeckt |
| hidden_until_condition | sichtbar, sobald Bedingung erfuellt |
| party_specific | nur bestimmte Player/Groups |
| session_only | nur fuer konkrete Session relevant |

## Visibility Is Data

Nicht nur Seiten sollten Sichtbarkeit haben, sondern:

- Entity
- Property
- Textblock
- Relation
- Map Marker
- Timeline Event
- Handout
- Card
- Rules Note

Beispiel:

```json
{
  "block_id": "blk_secret_ritual",
  "type": "paragraph",
  "text": "The ritual requires three black dragon scales.",
  "visibility": {
    "default": "gm_only",
    "show_if": "flags.black_dragon_scales_clue == true"
  }
}
```

## Session Page Model

```json
{
  "id": "session_042",
  "title": "Warehouse Investigation",
  "world_time_start": 184250,
  "variables": {
    "alarm_level": 0,
    "entered_warehouse": false,
    "round": 0
  },
  "sections": [
    {
      "type": "embed",
      "entity_id": "loc_bog_warehouse",
      "display": "summary_card",
      "visibility_override": "gm_only"
    },
    {
      "type": "conditioned_reveal",
      "label": "Hidden Hatch",
      "show_if": "variables.entered_office == true && checks.investigation >= 15",
      "content": []
    }
  ]
}
```

## Condition Engine

Anforderung:

- speicherbar in JSON
- lokal ausführbar
- sicher
- deterministisch
- keine beliebigen Scripts
- auch im Frontend interpretierbar
- idealerweise mit UI-Builder erzeugbar

## Options

| Engine | Vorteile | Nachteile | Empfehlung |
|---|---|---|---|
| eigenes Mini-DSL | exakt passend | hoher Aufwand, schnell buggy | nur sehr klein halten |
| JsonLogic | JSON-native, sicher, keine Loops, gut speicherbar | fuer Menschen nicht schoen lesbar | gut fuer V1 |
| CEL | lesbarer, schnell, sicher, fuer Policies geeignet | Integration je Stack pruefen | sehr guter Kandidat |
| JavaScript eval | flexibel | Sicherheitsproblem | vermeiden |
| SQL expressions | stark fuer DB | schlecht im Frontend | nur intern |

JsonLogic ist attraktiv, weil Regeln selbst JSON sind und laut Dokumentation bewusst klein, deterministisch und ohne Side Effects gehalten sind. CEL ist ebenfalls fuer sichere eingebettete Expressions gebaut.

## Recommended Hybrid

User sieht:

```text
Show when:
  entered_warehouse is true
  and alarm_level >= 2
```

Gespeichert wird:

```json
{
  "and": [
    {"var": "session.entered_warehouse"},
    {">=": [{"var": "session.alarm_level"}, 2]}
  ]
}
```

Oder CEL:

```text
session.entered_warehouse && session.alarm_level >= 2
```

## Session Variables

Variablen sollten typisiert sein:

```json
{
  "id": "alarm_level",
  "type": "number",
  "label": "Alarm Level",
  "default": 0,
  "min": 0,
  "max": 5,
  "control": "stepper"
}
```

Variablentypen:

| Type | Use Case |
|---|---|
| boolean | lever pulled, clue found |
| number | alarm level, counter, market threshold |
| enum | weather, guard state |
| timer | ritual countdown |
| relation | selected NPC, current location |
| check_result | last skill check |

## Trigger Types

| Trigger | Beispiel |
|---|---|
| manual | GM klickt "revealed" |
| time-based | nach 10 Minuten |
| round-based | nach 3 Runden |
| event-based | wenn NPC X stirbt |
| check-based | Investigation >= 15 |
| state-based | alarm_level >= 3 |
| location-based | party enters region |

## Player View

Player View ist keine separate Welt. Es ist eine Projektion.

```text
Core Data + Visibility Context -> Player Projection
```

Context:

```json
{
  "audience": "players",
  "party_id": "main_party",
  "session_id": "session_042",
  "known_flags": ["met_silas", "found_battery"],
  "permissions": ["view_public", "view_discovered"]
}
```

## Embedded Lore

Session Pages sollten auf Core Entities verweisen:

```json
{
  "type": "entity_embed",
  "entity_id": "npc_silas",
  "mode": "compact",
  "fields": ["title", "summary", "motivation", "secrets"],
  "field_visibility": {
    "secrets": "gm_only"
  }
}
```

Vorteil:

- keine Dopplung
- Core-Lore bleibt aktuell
- Session zeigt nur relevante Ausschnitte
- Player View kann automatisch gefiltert werden

## Capture Mode

Capture ist eine Inbox mit Nacharbeitsflag.

```json
{
  "id": "capture_01J...",
  "type": "capture_note",
  "created_in_session": "session_042",
  "raw_text": "Guard says Silas owes money to the Weavers.",
  "suggested_entity_type": "relation",
  "status": "needs_processing",
  "links": ["npc_silas", "faction_weavers"]
}
```

Capture Types:

| Type | Nacharbeit |
|---|---|
| new_npc | Entity anlegen oder mergen |
| new_location | Location anlegen |
| decision | Session Log + State Change |
| open_question | Todo |
| improvised_lore | Core-Lore pruefen |
| relation_hint | Relation bestaetigen |
| rule_ruling | Rule/House Rule anlegen |

## Decision Questions

1. Soll Sichtbarkeit blockgenau sein oder nur entity-/section-genau? --> Section-genau für V1
2. Welche Condition Engine: JsonLogic oder CEL? --> ich neige zu CEL auf der anderen seite hätt ich schon gern noch einfacher also gewrapped in ein schönen editor klicki-bunti-style: dann ist CEL versteckt und lohnt sich ga rnciht und man kann doch wieder json nutzen? oder trotzde sinnvoll perfromance-wise?
3. Braucht V1 echte Player Accounts oder reicht Export/Player View? --> "Accounts" nicht, player View/Export reicht, aber vlt mitdenken datentechnisch damit eine V2/V3 cloud variante auch accounts easy kann
4. Werden Session Variables global wiederverwendbar? --> optional ja es gibt globale Variablen und Session-variablen und sie können entweder sich gegenseitig überschrieben oder nur in eine richtung oder sind komplett isoliert.
5. Soll Capture automatisch Vorschlaege machen oder erstmal nur Inbox sein? --> auto-vervollstädigung gern. Intelligente automatische vorschläge: nein
6. Werden Player Decisions automatisch StateChanges? --> nur falls sich eine variable dadurch ändert.

## Recommendation

Fuer V1:

- Sichtbarkeit auf Entity, Field, Block, Marker.
- Player View als Projektion.
- Session Page mit Embeds statt Lore-Duplikation.
- JsonLogic fuer gespeicherte Regeln oder CEL wenn Stack gut passt.
- Capture Inbox mit `needs_processing`.
- Variables und Conditions simpel halten, aber Datenmodell robust bauen.

## Sources

- JsonLogic: https://jsonlogic.com/
- CEL: https://cel.dev/
- CEL spec: https://github.com/google/cel-spec
- Owlbear Rodeo SDK metadata/permissions concepts: https://docs.owlbear.rodeo/extensions/reference/
- LegendKeeper permissions/secrets feature reference: https://www.legendkeeper.com/features/
