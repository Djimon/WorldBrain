# EPIC-014: System Plugin & Character Sheet

> ⚠️ **In Überarbeitung — Konsolidierung M6 ↔ M9 (#225). Teile unten werden großflächig geändert.**
> Klarstellung: **M9 liefert das *eine* konkrete System-Plugin** (`dnd5e_srd`, snake_case) — echte Regeln (als Rule-Entities), Mechanik (Formeln/Lookup/2D/Conditionals), Schemas *wie* Spell/Item/NSC/Monster/Charakterbogen definiert werden, plus Beispiel-Entities. M6 ist nur die systemagnostische Grammatik. Das in der M9-S06-Spec verwendete `dnd5e-srd` (Bindestrich) + separates `db_prefix: "dnd5e"` war falsch und wird auf `dnd5e_srd` vereinheitlicht. Der Regel-Referenz-Inhalt des bisherigen M6-`dnd5e_srd` wandert **in dieses eine Plugin**. Neue, sauber strukturierte Issues/Epics folgen nach der SRD-Grammatik-Vollständigkeitsprüfung.

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
13. **Zwei derived-Typen — `formula` und `lookup`:** Ein computed-Feld ist entweder `formula` (Arithmetik über `condition-engine.ts`) **oder** `lookup` (Wert aus einer Tabelle, indiziert per Schlüssel-Feld). Tabellen sind **deklarative Plugin-Daten** (`tables/*.json`), kein neuer Engine-Operator. Threshold-Systeme (D&D: Proficiency Bonus nach Level) → `lookup`; glatt skalierende Systeme → `formula`. Beides ist über Decision 12 verkettbar (`prof_bonus` via lookup → `skill_mod` via formula). Beispiel: `"prof_bonus": { "computed": true, "lookup": { "table": "prof_by_level", "key_field": "level" } }`.
14. **Referenz-Modell nach Entity-Typ getrennt:** **Spielerbögen** existieren nur innerhalb der Session und nutzen einfache **Referenz-Felder** (`"known_spells": { "type": "ref[]", "target": "spell" }`, Inventar als eingebettete Objekte `{ref, qty, equipped}`, Feats, Species). **Creatures/NPCs** nutzen zusätzlich **Wissensgraph-Relations** zu Fähigkeiten/Spells, damit der DM nach Fähigkeit + CR filtern kann ("Monster mit Feuerball, CR 3–4"). Der Graph ist Backend-/Lore-Gerüst — nicht der Spielerbogen.
15. **Aktiv-Zustands-Toggles (V1 manuell):** Bedingte Boni (Rage +2, Cover) hängen an session-state-Booleans, die der Spieler **selbst an/aus schaltet**; derived-Felder lesen sie über die and/or-Logik. Automatisches Berechnen von Dauer/Ende einer Wirkung ist **V2, out of scope**.
16. **Dice-Felder — Ausdruck + Anzeige-Average:** HP/Damage-Felder speichern den Würfelausdruck (`23d12+151`, `8d6`). Der berechnete Durchschnitt ist eine **reine Anzeige-Hilfe** (Erwartungswert für den Spieler), kein Ersatz fürs echte Würfeln (M8-S11).
17. **Voll-Loading in eigenen DB-Bereich:** Ein System-Plugin deklariert im Manifest ein **Pflicht-`db_prefix`** (z.B. `dnd5e`). Beim Laden werden die `entity_types/*.json` **real eingelesen und eager in `<prefix>_*`-Tabellen materialisiert** — kein Registry-Stub. (Löst die frühere "tote Loader"-Lücke, siehe [[project-system-plugin-substrate-gap]].)
18. **Fidelity-Ziel: spielbar-vollständiger 5e-Bogen** (korrigiert eine frühere, nicht bestätigte "Substrat-Beweis"-Fassung). Der Bogen wird am Tisch geführt: korrekte, abgeleitete Rechenwerte (Skills, Saves, AC, HP, Spell-Slots) + Session-Tracking. **Out (V1):** automatischer Character-Builder / Levelup-Wizard (siehe Decision 20 + Out-of-Scope).
19. **Engine-Vollausbau ist Pflicht, nicht optional:** Zusätzlich zu `formula`+`lookup` (Decision 13) sind **Conditionals** (`if()`, Vergleiche, `and`/`or`/`not` im Formel-Parser — M9-S09) und **2D-Lookup** (Tabellen mit zwei Schlüsseln, Klasse × Level — M9-S10) Pflicht-Fundament. Idiome: Proficiency/Expertise/Saves via **0/1-Flag-Multiplikation** (`mod + proficient * prof_bonus`); echte Verzweigung (unarmored AC) via `if()`. **Nicht** per Term-Weglassen modellieren.
20. **Level-up-Readiness (vordenken, nicht bauen):** Alle level-abhängigen Werte werden **level-getrieben abgeleitet** (`lookup`/`formula` über die base-Felder `level` und `class`) — nie handgetragene Konstanten. Dadurch re-derived ein Ändern von `level` **automatisch** alles (prof_bonus, Spell-Slots, …). V1 liefert **keine** Level-up-UI, aber der Kern ist so gebaut, dass ein späteres Level-up-Feature eine reine **UI/Flow-Schicht** ist (setzt `level`, wählt neue Features) — **kein Kern-Umbau**.
21. **Jede Deklaration ist per stabiler ID adressierbar und überschreibbar.** Jedes Feld/Formel/Lookup/Tabelle trägt eine stabile ID (z.B. `formula:ac_total`, `table:prof_by_level`). Voraussetzung dafür, dass Hausregeln (EPIC-019 House-Rule Overlays) *einzelne* Regeln übersteuern können, ohne das Plugin zu forken. **Jetzt mitziehen — nachrüsten ist teuer.** Spiegelbild zu M12-Decision 12.

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

### M9-S06: D&D 5e SRD Referenz-Plugin

**Ziel:** Ein **spielbar-vollständiger 5e-Charakterbogen** als erstes echtes System-Plugin — ein Bogen, den man am Tisch führt: korrekte Rechenwerte (Skills, Saves, AC, HP, Spell-Slots) + Session-Tracking. Zugleich der vollständige Durchstich durch das M9-Substrat (Schema-Format, `formula`+`lookup`+Conditionals+2D-Lookup, Dice, session-state, Referenzen/Relations, i18n, DB-Prefix-Loading). Builder/Levelup-Wizard bleibt V1-out (Decisions 18–20).

**Plugin-Struktur:**
- `plugins/dnd5e-srd/` mit `plugin.json`, `entity_types/*.json`, `tables/*.json`, `locales/{en,de}.json`, `assets/`
- Manifest: `system: true`, **`db_prefix: "dnd5e"`** (Pflicht, Decision 17), `mechanics`-Block

**mechanics:** attributes `[str,dex,con,int,wis,cha]`; challenge_metric `cr`; distance_units `[ft,mile]`; resource_types `[hp, spell_slots_1..9, hit_dice]`. Jedes Schema-Feld ist als **base / session-state / derived(formula|lookup)** markiert (Decision 9/13).

**Tabellen (Decision 13, als Daten):** `tables/prof_by_level.json` (1D-Threshold 1→+2 … 17→+6). Ability-Modifier bleiben `formula` (`floor((x-10)/2)`). **Spell-Slot-Progression** über 2D-Lookup Klasse × Level (M9-S10), `tables/spell_slots_*.json` — Max wird abgeleitet, Verbrauch (`spell_slots_used_*`) ist session-state.

**`player_character` (Referenz-Felder, Decision 14):**
- base: `species` (ref:species), `level`, `str/dex/con/int/wis/cha`, Skill-Proficiency-Booleans, `class` (V1 Freitext)
- derived `lookup`: `prof_bonus` (Tabelle `prof_by_level`, key `level`)
- derived `formula`: `str_mod`…`cha_mod`; **Skill-Mods proficiency-gated** über 0/1-Flag-Multiplikation `<ability>_mod + proficient * prof_bonus (+ expertise * prof_bonus)` (18 explizit ausgeschrieben); Saving Throws analog; `passive_perception`; `ac_total` via Conditional `if(is_unarmored, 10 + dex_mod, armor_ac)` (M9-S09)
- derived `lookup` (2D, M9-S10): `spell_slots_1_max`…`spell_slots_9_max` über Klasse × Level
- base: `proficient_<skill>` / `expertise_<skill>` als 0/1-Flags; `save_prof_<ability>` als 0/1
- session-state: `current_hp`, `temp_hp`, `hit_dice_used`, `spell_slots_used_1..9`, `death_saves`, Aktiv-Toggles (z.B. `is_raging`, Decision 15)
- Referenzen: `known_spells` (ref[]:spell), `inventory` (eingebettet `{ref:item, qty, equipped}`), `feats` (ref[]:feat)

**`creature` (Graph-Relations, Decision 14):** Statblock-Felder (type, ac, hp als Dice, speed, ability scores, saves, skills, immunities/resistances, senses, languages, cr, xp) + Freitext-Sektionen (traits, actions, legendary/mythic/lair actions, special, description). Fähigkeiten/Spells als **Wissensgraph-Relation** → DM filtert nach Fähigkeit + CR. session-state: `current_hp` (session-scoped).

**`spell` / `item` / `feat` / `species`:** Referenz-Ziele; Felder gem. M9-S05.

**AC (Abnahme):**
- Plugin lädt fehlerfrei durch Validator (M6-S06) inkl. `mechanics`-Check (#164); Daten **eager materialisiert in `dnd5e_*`-Tabellen** (Decision 17)
- `prof_bonus` via `lookup` korrekt (Level 4→+2, 5→+3); Verkettung `skill_mod` nutzt lookup-basiertes `prof_bonus` (Decision 12/13)
- Alle 6 Ability-Mod-Formeln korrekt; `ac_total`-Beispiel rechnet
- Dice-Felder zeigen Ausdruck **+ Anzeige-Average**, klickbar (M8-S11, Decision 16)
- session-state pro (session × character) isoliert (#152/#156, Decision 11)
- `known_spells`/`inventory` als Referenz-Felder am PC; creature-Fähigkeiten als Graph-Relation nach CR filterbar
- Plugin-Locales `en`/`de` greifen (Namespace `plugin:dnd5e`, M11-S06 #214); Fallback = plugin-kanonischer String
- **SRD-Lizenz:** Inhalte aus SRD 5.1 unter **CC-BY-4.0**; fester Attribution-Wortlaut in `plugin.json` **und** sichtbar in der Plugin-Info-UI; nur SRD-Subset, kein PHB-only-Content
- SRD-Beispieleinträge (Proof-of-Concept): Goblin (creature), Fireball (spell), Healing Potion (item), Alert (feat), 1 SRD-Species, + **1 vorgefertigter `player_character`**, der alle Feld-Kategorien ausübt (base + formula + lookup + session-state + Referenzen)

**Fundament-Voraussetzungen** (aus dieser Spec abgeleitet — als eigene Stories, da #164/#165 bereits closed sind; nicht wieder aufmachen):
- **M9-S07 (#219):** zweiter derived-Typ `lookup` + Tabellen-Resolver (`tables/*.json`), Verkettung lookup→formula
- **M9-S08 (#220):** Referenz-Feldtypen (`ref` / `ref[]` / eingebettete Instanz-Objekte) + Manifest-`db_prefix` + eager Voll-Loading
- **M9-S09 (#222):** Conditionals im Formel-Parser (`if()`, Vergleiche, `and`/`or`/`not`) — für echte Verzweigung (unarmored AC)
- **M9-S10 (#223):** 2D-Lookup (Klasse × Level) — für Spell-Slot-Progression

#169 ist durch S07–S10 blockiert; danach reiner Konformanz-Durchstich (emergente Bugs → Follow-up-Fixes, vgl. #217/#218).

---

### M9-S07: lookup-Feldtyp & Tabellen-Resolver

**Ziel:** Zweiter derived-Typ `lookup` neben `formula` — Tabellen als Plugin-Daten, aufgelöst von einem separaten Resolver. Erweitert `formula-engine.ts`; `condition-engine.ts` bleibt unangetastet (kein neuer Formel-Operator). Herleitung: M9-S06 (#169) + Decision 13.

**AC:**
- Schema-Feld kann `"computed": true` + `"lookup": { "table": "<name>", "key_field": "<feld>", "mode": "threshold" | "exact" }` deklarieren (alternativ zu `"formula"`)
- Tabellen als Plugin-Daten in `tables/*.json`; Resolver lädt und indiziert per `key_field`
- `mode: threshold` = größter Tabellen-Key ≤ Wert (`prof_by_level` `{1:2,5:3,9:4,13:5,17:6}` → level 4→2, 5→3); `mode: exact` = exakter Key-Treffer
- Verkettung `lookup → formula`: ein `formula`-Feld darf ein `lookup`-Feld referenzieren (Topo-Auflösung Decision 12), Zyklen erkannt
- Fehlerfall (Tabelle fehlt, Key nicht auflösbar): zeigt `—` statt Crash
- Unit-Tests (`m9-s07-`): `prof_by_level` 4→+2 / 5→+3 / 17→+6; verkettetes `skill_mod`
- `database` prop typed as `DatabaseLike`; keine `unknown`/`as never` Casts

---

### M9-S08: Referenz-Feldtypen & DB-Prefix-Loading

**Ziel:** Referenz-Feldtypen im Schema + Manifest-`db_prefix` + eager Voll-Laden der Plugin-Schemas in einen eigenen DB-Bereich. Löst die tote Registry aktiv auf. Herleitung: M9-S06 (#169) + Decisions 14 + 17.

**AC:**
- Schema-Feld-Typen: `"type": "ref"` (1:1, `target` = Entity-Typ), `"type": "ref[]"` (many), eingebettetes Instanz-Objekt `{ ref, qty, equipped, … }` für Inventar-artige Referenzen
- Referenz-Integrität: `ref`/`ref[]` verweist auf gültigen Entity-Typ (Plugin oder Core); ungültiges `target` → Validator-Fehler
- Manifest: **`db_prefix` ist Pflichtfeld** für System-Plugins (z.B. `"dnd5e"`); Validator lehnt System-Plugin ohne `db_prefix` ab
- Loader liest `entity_types/*.json` **real ein** und materialisiert **eager** in `<prefix>_*`-Tabellen; `registerPluginEntityType` wird tatsächlich aufgerufen
- Prefix-Isolation: zwei Plugins mit verschiedenen Prefixes kollidieren nicht
- Abgrenzung: Referenz-**Felder** (Spielerbogen) + Loading hier; Wissensgraph-Relations für Creatures (CR-Filter) separat (M2-Graph, #167/#169)
- Unit-Tests (`m9-s08-`): Test-Plugin mit `db_prefix` + `ref`/`ref[]`/embedded lädt und materialisiert in Prefix-Tabellen
- `database` prop typed as `DatabaseLike`; keine `unknown`/`as never` Casts

---

### M9-S09: Conditionals in der Formel-Engine

**Ziel:** Vergleichs- und Bedingungs-Operatoren im Formel-**Parser**, für echte Verzweigung (unarmored AC vs. Rüstung, bedingte Boni). `condition-engine.ts` hat die Eval-Knoten bereits; der Parser in `formula-engine.ts` erzeugt sie noch nicht. Herleitung: Decision 19.

**AC:**
- Tokenizer/Parser erkennt Vergleiche `== != > >= < <=` mit korrekter Präzedenz (unter Arithmetik)
- Bool-Verknüpfung `and` / `or` / `not`
- Conditional `if(cond, then, else)` in Funktions-Syntax (passt zum vorhandenen Funktions-Aufruf-Parsing; bevorzugt vor `?:`)
- Verdrahtet an die vorhandenen `condition-engine`-AST-Knoten — **kein** zweiter Evaluator, keine `eval()`
- Boolean→Zahl-Coercion (`true`→1 / `false`→0)
- Muss gehen: `if(is_unarmored, 10 + dex_mod, armor_ac)`, verschachteltes `if`
- Fehlerfall → `—`, kein Crash
- Unit-Tests (`m9-s09-`): Vergleich, `and`/`or`, verschachteltes `if`, Präzedenz
- `database` prop typed as `DatabaseLike`; keine `unknown`/`as never` Casts

---

### M9-S10: 2D-Lookup (Tabellen mit zwei Schlüsseln)

**Ziel:** Lookup-Tabellen mit zwei Schlüssel-Feldern (Klasse × Level) für Spell-Slot-Progression. Erweitert `resolveLookup`/`evaluateLookupField` (heute 1D). Herleitung: Decision 19.

**AC:**
- Lookup-Feld kann zwei Schlüssel deklarieren: `"lookup": { "table": "<name>", "key_fields": ["class", "level"], "modes": ["exact", "threshold"] }` (gemischt: `exact` auf Klasse, `threshold` auf Level)
- Tabellen-Shape verschachtelt `table[keyA][keyB] = wert`; Threshold auf der numerischen Achse
- 1D bleibt voll kompatibel (`key_field`/`mode` gilt weiter)
- Anwendungsfall: `spell_slots_1_max`…`spell_slots_9_max` als je ein derived-Feld, 2D über Klasse × Level; Tabellen `tables/spell_slots_*.json`
- Unbekannte Klasse / nicht auflösbarer Level / fehlende Tabelle → `—`
- Unit-Tests (`m9-s10-`): Wizard L1 / L5 Slot-Counts; unbekannte Klasse → null; 1D-Regression grün
- `database` prop typed as `DatabaseLike`; keine `unknown`/`as never` Casts

---

## Story Tracking

| Story | ID | Titel |
|---|---|---|
| M9-S01 | #164 | System-Plugin Manifest-Erweiterung |
| M9-S02 | #165 | Formel-Engine für System-Felder |
| M9-S03 | #166 | Player Character Schema & UI |
| M9-S04 | #167 | Creature / Enemy Stat Block Schema & UI |
| M9-S05 | #168 | Spell / Item / Feat / Species Schemas |
| M9-S06 | #169 | D&D 5e SRD Referenz-Plugin (blockiert ← S07–S10) |
| M9-S07 | #219 | lookup-Feldtyp & Tabellen-Resolver |
| M9-S08 | #220 | Referenz-Feldtypen & DB-Prefix-Loading |
| M9-S09 | #222 | Conditionals in der Formel-Engine |
| M9-S10 | #223 | 2D-Lookup (Tabellen mit zwei Schlüsseln) |

## Abhängigkeiten

- M6-S01–S06: Plugin-System vorhanden
- M6-S07–S11: Ruleset/Rules-Plugin vorhanden
- M8-S01: `system_plugin_id` auf Session-Schema
- M8-S08: Character-Panel Platzhalter
- M8-S11: Dice-Link-Layer (Würfelausdrücke klickbar)
- M9-S07 + M9-S08 + M9-S09 + M9-S10: Fundament-Voraussetzungen für M9-S06 (#169); bauen auf den closed #164/#165 auf, ohne sie wieder aufzumachen
