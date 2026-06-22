# 06 Rules Reference And Balance

## Goal

Rules & Reference Layer soll nicht nur eine eingebettete Website sein. Es soll ein systemagnostisches Modell fuer Regeln, Statblocks, Tables, Conditions und Bewertungen sein.

PnP-GMs brauchen waehrend der Session:

- Conditions
- DCs
- Travel Rules
- Encounter Tables
- Loot Tables
- Monster Actions
- Spell Summaries
- House Rules
- schnelle Suchbarkeit

Game Designer brauchen:

- Rule Modules
- balance-relevante Werte
- Dependencies
- progression impact
- content validation

## Architecture Principle

Trenne:

1. Rule Source: SRD, Homebrew, Import
2. Rule Entity: strukturierter Datensatz
3. Rule Reference: kurze Session-Ansicht
4. Rule Evaluation: optionale Berechnung
5. Rule Presentation: Card, Screen, Table

## Ruleset Plugin

```json
{
  "id": "ruleset_dnd5e",
  "label": "D&D 5e",
  "version": "2014-srd",
  "entity_types": ["spell", "monster", "condition", "class_feature"],
  "mechanics": {
    "attributes": ["str", "dex", "con", "int", "wis", "cha"],
    "challenge_metric": "cr",
    "distance_units": ["ft", "mile"]
  }
}
```

Systemagnostisch heisst:

- Das Core Tool weiss, was eine Rule Entity ist.
- Das DnD Plugin weiss, was Spell Level, Save DC, CR, Damage Dice bedeuten.
- Ein anderes Ruleset kann andere Felder liefern.

## Rule Entity Example

```json
{
  "id": "spell_fireball",
  "type": "spell",
  "ruleset": "dnd5e_2014",
  "title": "Fireball",
  "properties": {
    "level": 3,
    "school": "evocation",
    "casting_time": "1 action",
    "range": "150 ft",
    "save": "dex",
    "damage": [{"dice": "8d6", "type": "fire"}]
  },
  "reference_summary": "Dex save, 20-ft radius, 8d6 fire.",
  "body": {
    "format": "portable_blocks_v1",
    "blocks": []
  }
}
```

## DM Screen Model

Ein personalisierbarer DM Screen ist im Grunde eine gespeicherte Dashboard View.

```json
{
  "id": "screen_travel_session",
  "type": "gm_screen",
  "panels": [
    {
      "title": "Travel DCs",
      "source": {"type": "rule_table", "tag": "travel"}
    },
    {
      "title": "Active NPCs",
      "source": {"view_id": "view_session_npcs"}
    },
    {
      "title": "Conditions",
      "source": {"entity_type": "condition"}
    }
  ]
}
```

Damit wird 5e.tools DM Screen als Konzept ins eigene System uebertragen: nicht Regelwebsite kopieren, sondern eigene Panels bauen.

## Rule Reference Best Practice

Jede komplexe Rule braucht zwei Schichten:

| Layer | Zweck |
|---|---|
| Full Text | komplette Regel / Quelle |
| Table Summary | schnell erfassbare Spielhilfe |
| Card Summary | druck-/teilbar |
| Computable Fields | Level, DC, Damage, Tags |

Gerade fuer Spells ist das wichtig. Die Originalbeschreibung ist oft zu lang fuer Karten. Die Karte muss eine Spielhilfe sein, nicht die komplette Rechtsquelle.

## Balance Assistant

Ohne AI kann man schon viel machen.

### Encounter Difficulty

Systemagnostisches Modell:

```json
{
  "party_snapshot": {
    "members": 5,
    "level_band": "5-7",
    "resources": "medium"
  },
  "encounter": {
    "monsters": ["monster_yuan_ti_rogue", "monster_guard_01"],
    "terrain_tags": ["cover", "darkness"],
    "objective": "escape"
  }
}
```

Ruleset Plugin liefert Bewertung:

```json
{
  "difficulty": "hard",
  "risk_factors": [
    "enemy burst damage",
    "party lacks detection",
    "terrain favors ambush"
  ],
  "adjustments": [
    "reduce reinforcements by 1 wave",
    "add escape route"
  ]
}
```

### Homebrew Balance

Bewertbare Dimensionen:

| Dimension | Beispiele |
|---|---|
| Action economy | action, bonus action, reaction, passive |
| Resource cost | spell slot, points, per rest |
| Scaling | level, proficiency, attribute |
| Damage | expected damage, AoE, type |
| Control | stun, prone, restrain, charm |
| Defense | AC, saves, resistance |
| Frequency | at will, per short rest, per long rest |
| Stackability | concentration, exclusive state |

Das kann zuerst regelbasiert passieren, spaeter mit AI.

## Rules Intelligence Without AI

Beispiele:

### Mystery Breaker Detector

Eine Quest bekommt Constraints:

```json
{
  "quest_id": "mystery_hidden_killer",
  "fragile_to": ["zone_of_truth", "speak_with_dead", "detect_thoughts"],
  "mitigations": [
    "killer uses proxy",
    "corpse destroyed",
    "witness believes false memory"
  ]
}
```

Spell Tags:

```json
{
  "spell": "speak_with_dead",
  "tags": ["corpse_interrogation", "mystery_breaker"]
}
```

Query:

```text
Party has cleric level 5 -> spell available -> warn GM.
```

### Role Coverage

Party roles:

- frontline
- healer/support
- control
- utility
- face
- scout
- AoE
- single target

Ruleset Plugin maps classes/features/spells to capabilities.

### Quest Dependency

Use graph traversal:

- Quest requires clue A.
- Clue A is only in Location B.
- Location B is hidden unless NPC C tells party.
- NPC C is dead.

Tool warns:

> Quest may be blocked. Required clue has no currently accessible path.

## Open Data

Open rules data can seed the system.

Examples:

- Open5e API contains monsters/spells from SRD and other OGL sources.
- D&D 5e SRD APIs expose REST/GraphQL style data.
- Foundry systems model Actors, Items, Documents and system-specific data.

Legal warning: Rules imports must be license-aware. Do not assume every DnD source can be imported.

## Decision Questions

1. Wird DnD 5e ein offizielles Plugin oder nur Beispielplugin? --> DnD wird das erste beispiel-Plugin "offizielL" darf nur WotC
2. Wie tief soll V1 rechnen: nur Lookup oder einfache Evaluations? -> ja
3. Sollen Rule Entities bearbeitbar sein oder read-only imports? --> Imports read-only, Homebrew/Overrides bearbeitbar.
4. Braucht jede Rule einen `reference_summary`? --> nicht jede Rule technisch erzwingen, aber für Card-/Screen-fähige Rules Pflicht machen.
5. Werden Balance-Regeln als JSON-Plugin definierbar? --> Ja, JSON-Plugins definieren Balance-Regeln. Core liefert nur Engine + UI + Ergebnisformat.
6. Wie geht das Tool mit Lizenzquellen um? --> jede importierte Regelquelle als eigene Source mit Lizenz-Metadaten und jede Rule Entity referenziert ihre Quelle

## Recommendation

Fuer V1:

- systemagnostischer Ruleset-Plugin-Typ.
- DnD 5e nur als Beispielstruktur, nicht hart ins Core.
- DM Screen als Dashboard View.
- Rules haben Full Text + Summary + computable fields.
- Balance Assistant regelbasiert, nicht AI.
- Mystery Breaker / Quest Blocker / Encounter Risk als erste Intelligence-Features.

## Sources

- Open5e API: https://open5e.com/
- D&D 5e SRD API: https://www.dnd5eapi.co/
- D&D Beyond SRD: https://www.dndbeyond.com/srd
- Foundry system development: https://foundryvtt.com/article/system-development/
- Foundry API docs: https://foundryvtt.com/api/
- Owlbear Rodeo extension SDK: https://docs.owlbear.rodeo/extensions/getting-started/
