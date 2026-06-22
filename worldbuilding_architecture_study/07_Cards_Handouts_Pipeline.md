# 07 Cards Handouts Pipeline

## Goal

Cards und Handouts sind keine hübsche Exportfunktion. Sie sind ein Weg, Weltwissen in spielbares Material zu übersetzen.

Wichtige Erkenntnis aus Spellcards:

> Eine Karte muss nicht die komplette Wahrheit enthalten. Sie muss am Tisch die richtige Entscheidung schneller machen.

Der Core-Eintrag bleibt die vollständige Quelle. Die Karte ist eine komprimierte Spielhilfe.

## Card Categories

V1 sollte mehrere Kategorien bieten, aber erweiterbar bleiben.

| Category | Zweck |
|---|---|
| NPC Card | schneller NPC am Tisch |
| Item Card | Loot, Artefakt, Questgegenstand |
| Spell/Ability Card | Spielerhilfe |
| Quest Card | Auftrag, Ziel, Belohnung |
| Clue Card | Mystery-Hinweise |
| Faction Card | Ruf, Ziele, Konflikte |
| Location Card | wichtige Ortsinfos |
| Secret Card | Reveal/Handout |
| Condition Card | Regelreferenz |
| Custom Card | Plugin-definiert |

## Card Is Projection

```text
Entity + Card Template + Visibility Context -> Card Output
```

Die Karte speichert nicht nochmal alle Daten.

```json
{
  "card_id": "card_fireball_player",
  "entity_id": "spell_fireball",
  "template_id": "dnd_spell_compact_v1",
  "audience": "player",
  "fields": ["title", "level", "casting_time", "range", "damage", "short_effect"]
}
```

## Template First

Nicht in V1 einen vollstaendigen Card Designer bauen.

Besser:

- hochwertige Standardtemplates
- sinnvolle Defaults
- klare Kategorien
- begrenzte Style-Optionen
- spaeter Advanced Designer

## Card Template Model

```json
{
  "id": "dnd_spell_compact_v1",
  "label": "D&D Spell Compact",
  "entity_types": ["spell"],
  "size": {
    "width_mm": 63,
    "height_mm": 88
  },
  "layout": [
    {
      "slot": "title",
      "field": "title",
      "max_lines": 1
    },
    {
      "slot": "meta",
      "fields": ["level", "school", "casting_time", "range"]
    },
    {
      "slot": "effect",
      "field": "reference_summary",
      "max_lines": 6,
      "overflow": "truncate"
    }
  ]
}
```

## Overflow Policy

Karten brauchen harte Regeln.

| Policy | Verhalten |
|---|---|
| truncate | kuerzen mit Hinweis |
| shrink | Schrift kleiner bis Minimum |
| split | Folgekarte erzeugen |
| summary_required | kein Export ohne Kurzfassung |
| reference_only | nur Link/QR/ID zur Core-Regel |

Empfehlung:

- Spellcards: `summary_required`
- NPC Cards: `truncate + core link`
- Item Cards: `split` nur optional

## Short Summary Field

Viele Entities brauchen ein explizites Card Summary Field:

```json
{
  "reference_summary": "Dex save, 20-ft radius, 8d6 fire. Ignites unattended flammables."
}
```

Dieses Feld ist kein Ersatz fuer Full Text.

## Print Layout

Fuer PnP wichtig:

- A4 3x3 Karten
- Schnittmarken
- Rueckseite optional
- PDF Export
- PNG Export
- digitale Share-Version

```json
{
  "print_sheet": {
    "page": "A4",
    "orientation": "portrait",
    "columns": 3,
    "rows": 3,
    "cut_marks": true,
    "backside": {
      "mode": "template",
      "template_id": "default_card_back"
    }
  }
}
```

## Handout Model

Handouts sind nicht immer Karten.

| Handout Type | Use Case |
|---|---|
| Letter | in-world Dokument |
| Map Fragment | player-facing Karte |
| Clue Sheet | gesammelte Hinweise |
| Faction Dossier | Spieleruebersicht |
| Session Recap | automatisierbarer Rueckblick |
| Shop Sheet | Angebot / Preise |

## Visibility

Handouts sollten aus Sichtbarkeit entstehen:

```json
{
  "handout_id": "handout_silas_letter",
  "source_entity_id": "item_silas_letter",
  "audience": "players",
  "include_fields": ["title", "visible_text", "image"],
  "exclude_visibility": ["gm_only"]
}
```

## Template Customization

V1:

- Theme-Farben
- Font-Auswahl begrenzt
- Icon/Symbol
- Kategorie-spezifische Felder
- automatische Klassen-/Schul-/Faction-Farben optional

Nicht V1:

- pixelgenauer Designer fuer alles
- beliebige Drag-Drop Layouts
- komplexer Textfluss um Bilder

## Decision Questions

1. Sind Cards Entities oder nur Exporte? --> exporte/Views auf Daten/entity
2. Muss jede Card eine Rueckreferenz auf Source Entity haben? --> ja
3. Wird PDF Export in V1 gebraucht? --> vermutlich ja.
4. Welche Standardgroessen: Poker, Tarot, Moderationskarte, A4 sheet? --> ja
5. Soll jede Kategorie eigene Pflichtfelder haben? --> ja
6. Wie stark sollen Templates vom Plugin definiert werden duerfen? --> ziemlich frei, wenn UI-json mitgeliefert wird

## Recommendation

Fuer V1:

- Cards als Projection/Export, nicht als eigene Wahrheit.
- Card Templates per JSON definierbar.
- `reference_summary` als Pflicht fuer kompakte Rules/Spell Cards.
- Kein All-in-Card-Zwang.
- PDF A4 3x3 als erstes Print-Ziel.
- Sichtbarkeit bei Handouts anwenden.

## Sources

- Daggerheart Card Creator: https://cardcreator.daggerheart.com/
- Daggerheart game aids: https://daggerheart.org/game-aids
- JSON Forms UI schema concepts: https://jsonforms.io/docs/uischema/
- react-jsonschema-form uiSchema: https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema/
