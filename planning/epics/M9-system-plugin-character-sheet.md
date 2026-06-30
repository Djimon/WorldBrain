# EPIC-014: System Plugin & Character Sheet

## Goal

Ein Rollenspiel-System (D&D 5e, DSA, Daggerheart, ...) wird als Plugin definiert und liefert die
Schemas für Charakterbögen, Stat Blocks, Spells, Items und alle weiteren system-spezifischen
Strukturen. Das Plugin gibt die Form vor — Homebrew-Inhalte füllt der DM selbst.

## Decisions

1. **Welt ≠ System:** Ein Projekt (Welt/Lore) ist system-agnostisch. Das System-Plugin wird pro Session gewählt (`system_plugin_id` auf Session, → M8-S01). Mehrere Sessions auf derselben Welt können unterschiedliche Systeme nutzen.
2. **Plugin liefert Schemas, nicht Inhalte:** Das System-Plugin definiert die Struktur (wie sieht ein Monster aus, wie ein Spell, wie ein Character Sheet). Homebrew-Inhalte bringt der DM selbst mit — sie werden in diese Schemas eingegossen.
3. **Kein System-Wechsel innerhalb einer Session:** System ist bei Session-Erstellung gewählt und fest. Wechsel = neue Session.
4. **D&D 5e Beispiel-Plugin:** Liefert vollständige Schemas (Stat Block, Spell, Character Sheet, Feat, Item, Species) + minimale SRD-Beispieleinträge als Proof-of-Concept. Kein proprietärer WotC-Inhalt.
5. **Berechnungen:** System-Plugin kann Formel-Felder definieren (z.B. `ac_total = 10 + dex_modifier`). Der Core wertet diese aus — Plugin definiert die Formel, Core führt sie aus. **Die Rechen-Engine existiert bereits in Teilen:** `src/services/condition-engine.ts` ist ein AST-Evaluator ohne `eval` (Variablen-Auflösung, Vergleiche, Bool-Logik, `+`/`-`/`*`/`/`). M9-S02 erweitert diese Engine, baut keinen neuen Parser.
6. **Stat Block Typen:** Zwei Typen: `player_character` (vollständige Progression, Ressourcen-Tracking) und `creature` (fixes Level/Stats, vorbereitet, 90% einmalig). Beide aus System-Plugin-Schema.
7. **Freie Felder:** Jeder Stat Block hat opt-in Freitext-Sektionen (`traits`, `actions`, `special`, `lair_actions`, `description`) — so kann beliebiges Homebrew rein ohne Schema-Erweiterung.
8. **Dice-Ausdrücke in Schemas:** HP-Felder wie `23d12+151` sind Würfelausdrücke, keine festen Zahlen. Der Core erkennt dice-Notation in Schema-Feldern und macht sie im Play-Modus klickbar (→ M8-S11).
9. **Drei Feld-Kategorien:** Jedes System-Schema-Feld ist entweder **base** (bei Erstellung gesetzt, z.B. `str = 16`), **session-state** (im Spiel veränderlich, z.B. `current_hp`, `slots_used`) oder **derived** (Formel über base + session-state, z.B. `str_mod`, `ac_total`). Derived wird on-read berechnet, nie persistiert.
10. **Verankerung:** Formel-/Schema-**Definition** lebt im Plugin-File (versioniert, mit dem System ausgeliefert). Nur **Werte** (base + session-state) liegen in der DB. So bleibt das System ein swappbares Plugin.
11. **Session-scoped State:** Session-veränderliche Felder (`current_hp`, verbrauchte Ressourcen) sind pro Session gespeichert — derselbe Charakter hat in zwei Sessions unabhängigen Zustand. Koppelt an M8-S01 (#152 Session-Schema) und Cross-Session World State (#156). Datenmodell dort mitdenken.
12. **Formel-Verkettung ist Pflicht:** Ein computed field darf andere computed fields referenzieren (`ac_total` → `dex_mod` → `dex`). Die Engine löst Abhängigkeiten in topologischer Reihenfolge auf und erkennt Zyklen (Fehler statt Endlosschleife). Reine Einzelformel-Auswertung reicht nicht — jeder will früher oder später Verkettung abbilden.

## Out of Scope

- Eigener Character Builder / Levelup-Wizard
- Automatische Regelprüfung ("darf dieser Charakter diesen Spell nehmen?")
- Multi-System gleichzeitig in einer Session
- Proprietärer D&D-Inhalt (nur SRD)
- Plugin-Signaturen

## Stories

### M9-S01: System-Plugin Manifest-Erweiterung

**Ziel:** Das Plugin-Format (M6) wird um System-Plugin-spezifische Felder erweitert.

**AC:**
- Plugin-Manifest kann `"system": true` deklarieren — markiert es als Regelwerk-Plugin
- Pflichtfelder für System-Plugins: `mechanics` Block mit `attributes` (Liste der Basis-Attribute), `resource_types` (HP, Spellslots, MP etc.), `distance_units`, `challenge_metric`
- System-Plugin darf zusätzlich liefern: `entity_types/player_character.json`, `entity_types/creature.json`, `entity_types/spell.json`, `entity_types/item.json`, `entity_types/feat.json`, `entity_types/species.json`
- Validierung beim Laden: System-Plugin ohne `mechanics`-Block wird abgelehnt mit klarer Fehlermeldung
- Nur ein System-Plugin pro Session aktiv (wird bei Session-Erstellung gewählt)
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M9-S02: Formel-Engine für System-Felder

**Ziel:** System-Plugin kann Felder mit Formeln definieren die der Core auswertet.

**AC:**
- Schema-Felder können `"computed": true` und `"formula": "10 + floor((dex - 10) / 2)"` deklarieren
- Unterstützte Operationen: `+`, `-`, `*`, `/`, `floor()`, `ceil()`, `max()`, `min()`
- Formel referenziert andere Felder des gleichen Entity-Objekts per Feldname — inkl. **base**, **session-state** und anderer **derived** Felder
- **Verkettung:** Ein computed field darf andere computed fields referenzieren (`ac_total` → `dex_mod` → `dex`). Auflösung in topologischer Reihenfolge; Auswertung pro Read genau einmal je Feld
- **Zyklenerkennung:** Eine zirkuläre Abhängigkeit (`a → b → a`) wird erkannt und als Fehler gemeldet (kein Stack-Overflow / keine Endlosschleife); betroffene Felder zeigen `—`
- Computed fields sind im UI read-only (angezeigt, nicht editierbar)
- Formel-Fehler (Division durch 0, unbekanntes Feld, Zyklus): zeigt `—` statt Crash
- Keine `eval()`-Nutzung. **Erweitert die bestehende Engine `src/services/condition-engine.ts`** (AST-Evaluator ohne `eval`) statt einen neuen Parser zu bauen — ergänzt fehlende numerische Operationen (`floor`/`ceil`/`max`/`min`), einen numerischen Auswertungs-Einstieg (heute liefert `evaluate()` nur Boolean) und Selbst-Referenz auf Entity-Felder
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M9-S03: Player Character Schema & UI

**Ziel:** Vollständiges Player-Character-Sheet das vom System-Plugin definiert wird.

**AC:**
- `player_character` Entity Type aus System-Plugin wird als vollständiges Formular gerendert
- Pflicht-Sektionen (vom Plugin definiert): Basis-Attribute, Ressourcen (HP, Spellslots etc.), Saving Throws (falls computed), Skills
- Opt-in Sektionen: Traits, Features, Spells, Inventory, Notes
- Ressourcen-Felder sind im Play-Modus direkt editierbar (HP hoch/runter, Spellslot verbraucht)
- Änderungen an Ressourcen erzeugen Session-Log-Eintrag
- Ohne aktives System-Plugin: nur Basisfelder (Name, Spieler, Freinotiz) — wie M8-S08
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API

---

### M9-S04: Creature / Enemy Stat Block Schema & UI

**Ziel:** Stat Blocks für Gegner und Verbündete werden vom System-Plugin definiert und sind im Play-Modus verwendbar.

**AC:**
- `creature` Entity Type aus System-Plugin: Felder analog zu D&D Stat Block (Type, AC, HP-Würfelausdruck, Speed, Ability Scores, Saving Throws, Skills, Immunities/Resistances, Senses, Languages, CR/XP)
- Freitext-Sektionen immer vorhanden: `traits`, `actions`, `legendary_actions`, `mythic_actions`, `lair_actions`, `special`, `description`
- HP-Feld akzeptiert Würfelausdruck (`23d12+151`) — im Play-Modus klickbar via M8-S11
- Creature-Entities können während einer Session HP-Tracking erhalten (aktueller HP-Wert, session-scoped)
- Stat Block View: kompakte Darstellung analog zu D&D Stat Block Layout
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M9-S05: Spell / Item / Feat / Species Schemas

**Ziel:** System-Plugin liefert Schemas für weitere regelrelevante Entity Types.

**AC:**
- `spell`: Felder für Level, School, Casting Time, Range, Components, Duration, Description, Damage-Ausdruck (Würfelausdruck klickbar)
- `item`: Felder für Typ, Seltenheit, Gewicht, Wert, Beschreibung, Spezialfähigkeiten (Freitext)
- `feat`: Felder für Voraussetzung, Beschreibung, Mechanischer Effekt (Freitext)
- `species`: Felder für Attribute Score Increases, Traits (Freitext-Liste), Subspecies (optional)
- Alle Typen: im Create-Modus als normale Entity anlegbar, im Play-Modus als Referenz abrufbar
- Würfelausdrücke in allen Feldern werden von M8-S11 erkannt und klickbar gemacht
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M9-S06: D&D 5e SRD Beispiel-Plugin

**Ziel:** Ein vollständiges D&D 5e System-Plugin liefert alle Schemas und minimale SRD-Beispielinhalte als Proof-of-Concept.

**AC:**
- Plugin-Ordner: `plugins/dnd5e-srd/` mit `plugin.json`, `entity_types/`, `assets/`
- `mechanics`: attributes `[str, dex, con, int, wis, cha]`, challenge_metric `cr`, distance_units `[ft, mile]`, resource_types `[hp, spell_slots_1–9, hit_dice]`
- Vollständige Schemas für: `player_character`, `creature`, `spell`, `item`, `feat`, `species`
- Computed fields: `str_modifier = floor((str - 10) / 2)` (und alle weiteren Ability Modifier)
- SRD-Beispieleinträge (je 1–2 pro Typ): 1 Creature (Goblin), 1 Spell (Fireball), 1 Item (Healing Potion), 1 Feat (Alert) — nur SRD-lizenzierte Inhalte
- Plugin lädt fehlerfrei durch den Plugin-Validator (M6-S06)
- Kein proprietärer WotC-Inhalt

---

## Story Tracking

| Story | ID | Titel |
|---|---|---|
| M9-S01 | #164 | System-Plugin Manifest-Erweiterung |
| M9-S02 | #165 | Formel-Engine für System-Felder |
| M9-S03 | #166 | Player Character Schema & UI |
| M9-S04 | #167 | Creature / Enemy Stat Block Schema & UI |
| M9-S05 | #168 | Spell / Item / Feat / Species Schemas |
| M9-S06 | #169 | D&D 5e SRD Beispiel-Plugin |

## Abhängigkeiten

- M6-S01–S06: Plugin-System vorhanden
- M6-S07–S11: Ruleset/Rules-Plugin vorhanden
- M8-S01: `system_plugin_id` auf Session-Schema
- M8-S08: Character-Panel Platzhalter
- M8-S11: Dice-Link-Layer (Würfelausdrücke klickbar)
