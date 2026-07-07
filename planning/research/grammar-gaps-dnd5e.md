# System-Plugin Grammar — D&D 5.1 SRD Completeness Analysis

> Research-Artefakt (Sub-Agent, 2026-07-07). Teil der M6↔M9-Grammatik-Vollständigkeitsprüfung (#225).
> Zweck: Prüfen, ob unsere system-agnostische Plugin-Grammatik die volle D&D-5.1-SRD-Mechanik ausdrücken kann — und wo die Lücken sind. Kein Implementierungsplan; treibt die Neustrukturierung der Epics/Issues.
> Verwandte Reports: [Pathfinder 2e](grammar-gaps-pathfinder2e.md), [Daggerheart](grammar-gaps-daggerheart.md), [Call of Cthulhu](grammar-gaps-call-of-cthulhu.md).

## 1. Our Primitives (what "expressible" means)

The grammar expresses a sheet as a flat bag of typed fields in three categories — **base** (set at creation, e.g. `str=16`), **session-state** (mutable in play, e.g. `current_hp`, `spell_slots_used_3`), and **derived** (computed on-read, never persisted). A derived field is either a **`formula`** or a **`lookup`**. The `formula` engine (`src/services/formula-engine.ts` → `condition-engine.ts`) parses a string into an AST and evaluates it with **no `eval`**: arithmetic `+ - * /`, functions `floor/ceil/max/min`, comparisons `== != > >= < <=`, boolean `and/or/not`, and a ternary `if(cond, then, else)` (M9-S09); booleans coerce to 1/0; formulas reference other fields by name and chain across derived fields in topological order with cycle detection (a cyclic field resolves to `—`). **`lookup`** resolves a value from declarative `tables/*.json` data by a numeric/string key in `threshold` (largest key ≤ input — e.g. proficiency bonus by level) or `exact` mode, now extended to **2D** (`key_fields:[class, level]`, mixed modes — M9-S10, spell slots). Beyond computed fields the grammar has: **`ref`/`ref[]`** typed references with embedded instance objects (`{ref, qty, equipped}` for inventory — M9-S08), plugin-level **db_prefix eager loading**, **knowledge-graph relations** (creature `can_cast`/`has_feature`, for CR-filtered DM queries), **dice fields** (store expression like `8d6`, display an average, clickable to roll — M8-S11, the engine does *not* roll or reason about dice), **free-text sections** for arbitrary homebrew, per-plugin **i18n**, and a separate read-only **rule-entity** layer (`rule_entities`: prose/table rules with source/license). Crucially: everything the *engine* computes is a **scalar number** produced deterministically from the character's own stored fields. There is no notion of a die roll's advantage/disadvantage, no typed-modifier arithmetic, no per-array aggregation, and no state-transition/reset logic.

## 2. SRD 5.1 Mechanics Inventory (computational surface)

**Core stats**
- Ability scores 1–30; modifier = `floor((score−10)/2)`.
- Proficiency bonus by character level: +2 (1–4), +3 (5–8), +4 (9–12), +5 (13–16), +6 (17–20).
- 18 skills, each tied to one ability; skill mod = ability mod (+ PB if proficient, + PB again if expertise).
- 6 saving throws (proficiency per class; some monsters/features add expertise).
- Passive score = 10 + relevant check mod (+5 advantage / −5 disadvantage).

**Defense & init**
- AC: armored (`armor base + Dex mod`, capped by armor type — light=full Dex, medium=Dex max +2, heavy=no Dex); Unarmored Defense (Barbarian `10+Dex+Con`, Monk `10+Dex+Wis`); natural armor; **+2 shield**; various flat bonuses.
- Initiative = Dex mod (+ bonuses).

**HP / life**
- Max HP = sum of hit-die rolls (or fixed averages) + Con mod × level; level 1 = max die + Con.
- Hit dice pool by class/level; short rest spends hit dice to heal (`roll + Con mod` each).
- Temp HP (doesn't stack — take highest, not additive).
- Death saves: 3 successes / 3 failures; nat 20 = regain 1 HP; nat 1 = two failures; damage while down = 1 failure (crit = 2).
- Long rest: restore all HP, half of total hit dice, all slots/most resources; exhaustion −1.

**Spellcasting**
- Spell slots per class × level (full/half/third-caster tables); Warlock **Pact Magic** is a separate table (few slots, all at highest level, recharge on **short** rest).
- Multiclass: combined caster level = full-caster levels + `floor(half-caster/2)` + `floor(third-caster/3)`, then read the multiclass slot table (Warlock excluded).
- Spells known vs prepared (prepared count = class ability mod + class level, varies by class).
- Spell save DC = `8 + PB + spellcasting ability mod`; spell attack = `PB + ability mod`.
- Cantrip damage scales at levels 5/11/17 (character level thresholds).
- Concentration (one at a time; Con save DC = max(10, half damage) to maintain).

**Attacks & damage**
- To-hit = ability mod + PB (if proficient) + bonuses; d20 vs AC.
- Damage = weapon/spell dice + ability mod (+ magic).
- **Critical hit**: roll all damage dice twice (nat 20 auto-hits).
- 13 damage types; **resistance** = half damage, **vulnerability** = double, **immunity** = zero (applied after other modifiers; multiple instances of resistance don't stack).

**Conditions (14)** — blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious — each imposes discrete rule effects (advantage/disadvantage grants, auto-fail saves, speed 0, attacks-against-have-advantage, etc.).
- **Exhaustion** (6 cumulative levels, SRD 5.1): 1 = disadvantage on ability checks; 2 = speed halved; 3 = disadvantage on attacks & saves; 4 = HP max halved; 5 = speed 0; 6 = death. A creature suffers its level **and all lower levels**.

**Advantage / disadvantage** — roll 2d20 take higher/lower; they don't stack and cancel to a single normal roll. Pervasive (conditions, cover, help, features).

**Class resources & conditional features** — Rage (uses/long rest, +damage while raging, resistance to b/p/s), Ki points, Sorcery points, Bardic Inspiration dice, Channel Divinity, Wild Shape, Sneak Attack dice (scales by level), Divine Smite, Second Wind, Action Surge, etc. Shape: **a counted resource (max by level, spent in play, reset on short/long rest) + a conditional bonus toggled on/off.**

**Feats / species** — feats grant fixed or conditional bonuses & sometimes ASIs; species grant ability score increases, speed, darkvision, resistances, proficiencies, innate spells.

**Creatures/monsters** — CR → proficiency bonus & XP (fixed table), stat block, legendary/lair/mythic actions, legendary resistance, multiattack, saving-throw & skill lists, damage resist/immune/vulnerable lists, condition immunities, senses (darkvision/blindsight/tremorsense/truesight ranges), passive Perception.

**Movement / capacity**
- Speeds (walk/fly/swim/climb/burrow); difficult terrain ×2 cost.
- Carrying capacity = `Str × 15` lb; push/drag/lift = `Str × 30`; encumbrance variant thresholds `Str×5` / `Str×10`.

**Random / table mechanics** — trinkets, wild magic surge (d100), treasure/loot tables, madness tables, and any homebrew d-table.

## 3. Mapping Table (mechanic → primitive OR GAP)

| SRD mechanic | Our primitive | Notes |
|---|---|---|
| Ability modifier | **formula** `floor((x-10)/2)` | ✅ implemented |
| Proficiency bonus by level | **1D lookup** threshold | ✅ implemented |
| Skill mod (prof + expertise) | **formula** w/ 0/1 flags + `if()` | ✅ implemented (18 fields) |
| Saving throws (prof) | **formula** w/ 0/1 flag | ✅ implemented |
| Passive Perception | **formula** `10 + perception_mod` | ✅ (advantage ±5 not modeled) |
| Armored AC (with Dex cap) | **formula** + `if`/`min` | Expressible: `armor_base + min(dex_mod, cap)` |
| Unarmored Defense / natural armor | **formula** + `if()` | Expressible (Barb/Monk variants via nested `if`) |
| Shield +2 | **formula** (add flat) | ✅ trivially |
| Initiative | **formula** = `dex_mod` | ✅ |
| Max HP | **formula** (avg) or **dice** field | Avg expressible; exact roll needs dice |
| Hit-dice pool | base/formula | Count = level; expressible |
| Temp HP ("take highest, no stack") | **session-state** + **GAP** | Storable, but "don't stack / take max on apply" is app logic, not a field |
| Death saves | **session-state** (string blob today) | Stored, not modeled as 3+3 counters/logic |
| Spell save DC / attack | **formula** `8 + prof + ability_mod` | ✅ expressible |
| Spell slots by class×level | **2D lookup** | ✅ implemented (non-Warlock) |
| **Warlock Pact Magic** (separate table, short-rest) | 2D lookup for count; **GAP** on reset | Count table works; short-rest recharge = GAP |
| **Multiclass** combined caster level | **GAP** | Needs `floor(half/2)+floor(third/3)` **across multiple `class`/`level` pairs**; schema has single `class` string + single `level` |
| Spells prepared count | **formula** `ability_mod + level` | Expressible; per-class variance needs conditionals |
| Cantrip scaling (5/11/17) | **1D lookup** threshold on level | Expressible |
| Concentration | **session-state** boolean | Toggle storable; save DC = `max(10, dmg/2)` needs runtime damage input → GAP |
| To-hit / damage bonus | **formula** | Expressible as scalars |
| Damage dice | **dice** field | ✅ display only |
| **Critical hit** (double dice) | **GAP** | Dice fields are opaque strings; engine can't transform `8d6`→`16d6` |
| Damage types | base `string[]` | ✅ as data |
| **Resistance/immunity/vulnerability math** | **GAP** | Lists storable (creature `resistances[]`); the ×0.5/×2/×0 *computation on incoming typed damage* is not expressible (no typed-damage pipeline) |
| **Advantage / disadvantage** | **GAP** | A dice-roll modifier (2d20 kh/kl), not scalar arithmetic; engine has no concept of it |
| **Conditions (14) effects** | rule-entity prose + **GAP** for effects | Prose storable; their *mechanical effects* (grant disadvantage, auto-fail, speed 0) are not applied by any primitive |
| **Exhaustion cumulative effects** | session-state int + **GAP** | Level storable; "level N implies all effects ≤ N, halve speed, halve HP max, disadvantage" is a cumulative-effect GAP |
| Class resource counters (rage/ki/etc.) | **session-state** (used) + **lookup** (max by level) | ✅ expressible |
| Conditional bonuses (rage +dmg, cover) | **session-state boolean + `if()`** | ✅ (manual toggle, Decision 15) |
| **Same-type bonuses don't stack** | **GAP** | `max()` handles two known operands, but there's no typed-modifier bucket that auto-dedupes contributions |
| Feats (fixed effects) | **ref[]** + free text | Reference/data ✅; mechanical effect application → GAP |
| Species ASI / traits | **ref** + free text; ASI via formula | ASI expressible if modeled as fields; traits are prose |
| CR → PB / XP | **1D lookup** | Expressible |
| Legendary/lair/mythic actions | **free-text sections** | ✅ (prose only) |
| Creature senses/passives | base fields | ✅ |
| Carrying capacity | **formula** `str * 15` | ✅ |
| **Encumbrance from inventory weight** | **GAP** | Needs **sum over `inventory[].weight × qty`** — no array aggregation primitive |
| Movement / speed | base field | ✅ (difficult-terrain math is runtime) |
| **Random tables (d100 etc.)** | **GAP** | `lookup` is deterministic key→value; no random-roll-into-table primitive |
| Rest recovery (short/long reset) | **GAP** | No hook to reset session-state (`spell_slots_used_*`→0, hit_dice restore, exhaustion −1) |

## 4. Prioritized Gap List (recommended new primitives)

### Tier A — Essential for a genuinely *playable* sheet
The M9-S07–S10 plan makes the sheet *compute correctly at rest*, but several gaps block actually running it at the table.

1. **Rest-reset hook (state-transition primitive).** *Essential.* Nothing resets session-state. A playable sheet must, on Short/Long Rest, zero `spell_slots_used_*`, restore hit dice, reset per-rest resources (ki, rage, Warlock slots on short rest), and decrement exhaustion. **Recommendation:** declarative reset descriptors per session-state field (`"resets_on": "long_rest" | "short_rest"`, plus `"recover": "all" | "half" | "-1"`), executed by a core rest action. This is *not* in M9-S07–S10 and is the single biggest omission.

2. **Multiclass model.** *Essential if multiclassing is in scope; otherwise document as out.* The PC schema has a **single** `class` string and single `level`. Multiclass caster level (`full + floor(half/2) + floor(third/3)`) and per-class features are **inexpressible** — there is no array of `{class, level}` and no aggregation over it. **Recommendation:** repeatable class entries + an aggregation primitive (see #4). M9-S06's own AC lists `class` as "V1 Freitext", so today multiclass is silently unsupported.

3. **Array-aggregation primitive (`sum`/`count`/`any` over `ref[]`/embedded arrays).** *Essential.* Needed for **encumbrance** (`sum(inventory[].weight × qty)`), attuned-item counts, total spells prepared, and multiclass caster level. The formula engine operates only on flat scalar fields; it cannot fold over the `inventory`/`known_spells` arrays it already stores. **Recommendation:** add `sum(field.path)`, `count(...)`, `map/×` reducers to the engine.

4. **Advantage/disadvantage as a dice/roll flag.** *Essential for play* (this is the most-used mechanic in the game). It is fundamentally **not arithmetic** — it's "roll 2d20 keep highest/lowest, they cancel." **Recommendation:** extend the dice/roll layer (M8-S11) with an `advantage`/`disadvantage` flag on a rollable field, plus passive ±5. The scalar formula engine cannot and should not model this.

### Tier B — Needed for correct combat resolution
5. **Typed-damage resistance/immunity/vulnerability pipeline.** *Essential for creature combat, nice-to-have for a pure PC sheet.* Lists are stored but the ×½/×2/×0 math on incoming typed damage has no home. **Recommendation:** a small typed-damage resolver (input: amount+type, character's resist/immune/vuln sets → output amount), living in the play/roll layer, not the field engine.

6. **Critical-hit dice transform.** *Nice-to-have.* Dice fields are opaque strings the engine can't manipulate (`8d6`→`16d6`). **Recommendation:** handle in the dice-roll layer (a "crit" roll mode that doubles dice count), not the formula engine.

7. **Condition/exhaustion effect model.** *Nice-to-have for automation, prose-sufficient for V1.* Conditions and cumulative exhaustion currently live only as prose. Applying their effects (disadvantage grants, speed halving, HP-max halving, "level N ⇒ all ≤ N") needs either (a) a condition→modifier mapping table feeding the advantage flag (#4) and derived fields, or (b) accept manual play (consistent with Decision 15's manual-toggle philosophy). Recommend documenting as manual-for-V1 but note that exhaustion's *cumulative HP-max/speed* effects want at least an `if(exhaustion>=4, hp_max/2, hp_max)` formula hook, which **is** expressible today if exhaustion level is a base/session field — worth adding to the reference PC.

### Tier C — Robustness / correctness of the model
8. **Typed-modifier stacking rules ("same source doesn't stack").** *Nice-to-have.* `max()` covers hand-authored two-operand cases, but there's no general "bucket of typed bonuses, take highest per type" (e.g. multiple AC bonuses, temp-HP "take highest"). Low priority for SRD-only V1; flag for homebrew-heavy use.

9. **Random-table roll primitive.** *Nice-to-have.* `lookup` is deterministic; wild-magic/trinket/loot d100 tables need "roll die → index table." **Recommendation:** a `roll_table` combining the dice layer with `exact`/`threshold` lookup. Not needed for the core sheet.

10. **Death saves as structured counters.** *Minor.* Currently a `string` blob. A `{successes, failures}` shape with the 3/3 threshold would let the sheet show the standard three-boxes UI. Cosmetic/UX, not blocking.

### Verdict on the current M9-S07..S10 plan
The four foundation stories (lookup, refs+db_prefix, conditionals, 2D-lookup) are **correct and sufficient for the *static, at-rest* derived values** — ability mods, skills, saves, AC, passive perception, single-class spell slots, prof bonus. They are **not sufficient for a sheet you run at the table.** The plan has **no primitive for the three things a live sheet needs most**: (a) **resting/reset** (Tier A #1), (b) **advantage/disadvantage** on rolls (Tier A #4), and (c) **aggregation over the arrays it already stores** — encumbrance, multiclass, prepared counts (Tier A #3). Multiclass (#2) is quietly unsupported by the single-`class` schema. These four (#1–#4) should become new issues/epics before `dnd5e_srd` (#169) can honestly claim "spielbar-vollständig." The combat-resolution gaps (#5–#7) and #8–#10 can be scoped as follow-ups or explicitly deferred, consistent with the existing manual-toggle (Decision 15) and dice-are-display (Decision 16) stances — but those two decisions are exactly what pushes advantage and typed damage out of the formula engine and into the **roll/play layer**, which currently has no design for them.

---

**Sources for SRD 5.1 specifics:** [Multiclassing – 5th Edition SRD](https://5thsrd.org/rules/multiclassing/), [Conditions/Exhaustion – 5th Edition SRD](https://5thsrd.org/rules/conditions/).
