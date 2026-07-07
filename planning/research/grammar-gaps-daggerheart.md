# System-Plugin Grammar — Daggerheart (+ Call of Cthulhu) Completeness Analysis

> Research-Artefakt (Sub-Agent, 2026-07-07). Teil der M6↔M9-Grammatik-Vollständigkeitsprüfung (#225).
> Zweck: Daggerheart (primär) + CoC-Kurzpass finden Mechaniken, die unsere D&D-abgeleitete Grammatik NICHT ausdrücken kann. Für die *tiefe* CoC-Analyse siehe [grammar-gaps-call-of-cthulhu.md](grammar-gaps-call-of-cthulhu.md).
> Verwandte Reports: [D&D 5e](grammar-gaps-dnd5e.md), [Pathfinder 2e](grammar-gaps-pathfinder2e.md), [Call of Cthulhu (dediziert)](grammar-gaps-call-of-cthulhu.md).

Stress-testing our D&D-derived "system-plugin grammar." Reminder of what "expressible" means: flat typed fields (base / session-state / derived), where derived = `formula` (arithmetic + comparison + boolean + ternary, booleans coerce to 1/0, no eval, topo-ordered with cycle detection) or `lookup` (1D/2D declarative table, threshold or exact). Plus typed refs, KG relations, dice fields (opaque expression string, shows an average, engine never rolls/reasons), free-text, i18n, prose rule-entity layer. **Every computed value is a deterministic scalar number derived from the character's own fields.**

---

## SYSTEM 1 — DAGGERHEART

### (1) Mechanics inventory

- **Duality Dice (2d12).** Every action roll is Hope die + Fear die. Sum vs Difficulty determines success/failure, but the *comparison of the two dice to each other* determines the "tone": Hope die higher → success/failure **with Hope** (gain 1 Hope); Fear die higher → **with Fear** (GM gains 1 Fear); **matching dice → critical success** (auto-succeed, gain Hope AND clear Stress). So one roll produces a **2-axis outcome**: (magnitude vs difficulty) × (Hope/Fear/crit tone).
- **Traits** (6): Agility, Strength, Finesse, Instinct, Presence, Knowledge. Static modifiers (−1…+2 range at creation) added to the relevant action roll. These are ordinary flat base fields.
- **No hit-point number / Damage Thresholds.** Characters have no numeric HP pool to subtract from. Instead three thresholds — **Minor / Major / Severe** — each = base (from armor) **+ character level**. Incoming damage *amount* is banded: below Major → mark 1 HP; ≥ Major & < Severe → mark 2 HP; ≥ Severe → mark 3 HP; reduced to ≤0 → mark 0. Damage → **number of track marks** via a band.
- **HP track & Stress track.** Fixed number of clickable slots (marked/unmarked), not a countdown integer. Marking the last HP triggers a **death move**. Stress is marked/cleared by many effects; when Stress is full you can't mark more and take consequences.
- **Evasion + Armor Slots** instead of AC. Evasion is the difficulty an attacker must beat (a scalar — fine). **Armor Slots** are a consumable track: spend a slot to reduce incoming damage by one threshold band before the mark is computed.
- **Hope metacurrency.** A spendable pool (cap ~6) gained on "with Hope" outcomes and crits, spent to fuel Experiences, help allies, and class **Hope features**. Player-facing economy, not derived from stats.
- **Fear** (GM-side counterpart pool) — outside the character sheet, but it's the mirror resource the sheet's outcomes feed.
- **Experiences.** Freeform player-authored tags ("Sailor," "I never forget a face") that grant **+2** when the GM rules them relevant; activating one **costs 1 Hope**. Situational, non-declarative applicability.
- **Domain cards.** Loadout of chosen ability cards (spells/abilities), each with its own recharge/cost text; a bounded loadout + vault. Card *effects* are prose; the *loadout constraint* (max N in loadout) is a countable list.
- **Tier-by-level scaling.** Level 1 / 2–4 / 5–7 / 8–10 map to tiers; tier drives proficiency (damage dice multiplier), threshold growth, and available upgrades — a banded lookup on level.
- **Proficiency & damage.** Weapon damage = `[proficiency]d[weapon die] + bonus`; proficiency = number of dice, scaling by tier. Damage is a dice expression whose *dice count is itself computed*.
- **Rally / Tag-team / group Hope spends** — cooperative resource transfers between characters.

### (2) Mapping table

| Mechanic | Our primitive / GAP |
|---|---|
| Traits (Agility…Knowledge) as flat modifiers | ✅ base fields |
| Trait added to action roll total | ⚠️ Partial — the *modifier* is a field, but the 2d12 roll itself is opaque (dice field). Engine can't evaluate the roll. |
| Evasion (attacker difficulty) | ✅ derived scalar (formula) |
| Damage thresholds Minor/Major/Severe = armor + level | ✅ formula (`base_minor + level`, etc.) — the *values* are fine |
| Damage amount → mark 1/2/3 HP band | ❌ **GAP** — needs a threshold lookup keyed on an *external input* (incoming damage), not the character's own fields. Our lookup only reads the character's own scalar fields. |
| HP track / Stress track (marked slots, last-mark → death move) | ❌ **GAP** — track is a bounded marked/unmarked slot array with state semantics, not a scalar. Session-state can hold a number, but "mark N", "clear on rest", "full → consequence" are state transitions. (Shares D&D's no-rest/reset gap; worse here because it's a *slot array* not a countdown.) |
| Armor slot spend → shift damage down one band | ❌ **GAP** — consumable resource modifying a *band lookup input*; interactive, not on-read scalar. |
| Duality outcome: magnitude × Hope/Fear/crit tone | ❌ **GAP** (biggest) — a single roll yields a **structured multi-axis outcome** driving a metacurrency. No banded/degrees-of-success concept, and no asymmetric-dice-pair comparison. Extends D&D's degrees-of-success gap AND its advantage gap in a new direction. |
| Matching dice = critical | ❌ **GAP** — dice-identity condition; engine never sees die faces. |
| Hope pool (gain on outcome, spend on features) | ❌ **GAP** — metacurrency; gains are *triggered by roll outcomes*, not derivable. Session-state number can store it, but earn/spend rules are event-driven. |
| Experiences (+2 freeform tags, cost 1 Hope) | ❌ **GAP** — situational modifier with human-adjudicated applicability + a cost. No "conditional/optional modifier gated on GM ruling + resource spend." |
| Domain card loadout (max N) | ⚠️ Partial — `ref[]` list holds the cards; loadout *cap* enforcement is a validation constraint we don't express. Card effects → prose layer ✅. |
| Tier-by-level scaling | ✅ `lookup` (threshold on level) for tier, proficiency, threshold bonus |
| Damage = [prof]d[die] where prof is computed | ⚠️ Partial — dice field stores the string, but the **dice count is itself a derived value** that must be injected into the expression. Our dice field is an opaque literal string; it can't template a computed operand into the expression. Also the shown "average" can't reflect the computed count. |
| Rally / group Hope transfer | ❌ **GAP** — cross-character resource transfer; our derived values read only "the character's own fields." |

**Shared-with-D&D gaps present here:** no rest/reset state transition (HP/Stress/Armor/Hope all need it), no dice transforms, no random-table rolls, no typed-modifier stacking (Experiences would want it), no advantage concept (Duality is a stranger cousin).

---

## SYSTEM 2 — CALL OF CTHULHU 7e (Kurzpass; siehe dedizierten Report für Tiefe)

### (1) Mechanics inventory

- **d100 roll-under.** Roll ≤ skill value = success. The skill is a percentage (0–99).
- **Success levels from ONE value.** Same skill yields banded outcomes: **Regular** ≤ skill, **Hard** ≤ skill/2, **Extreme** ≤ skill/5, **Critical** = 01, **Fumble** = 96–00 (00 always; 96–99 when skill < 50). One scalar → five bands, three of them via integer *divisors* of that scalar.
- **Characteristics** (0–99): STR/CON/SIZ/DEX/APP/INT/POW/EDU. Rolled/pointbuy at creation.
- **Derived attributes at creation:** **HP = (CON + SIZ) / 10** (round down), **MP = POW / 5**, **Sanity starts = POW** (max Sanity = 99 − Cthulhu Mythos), **Damage Bonus & Build** from STR+SIZ via a banded table, **Move (MOV)** from comparing STR/DEX to SIZ (three-way conditional) then adjusted by **age** bands.
- **Skill "half" and "fifth" values** are displayed on the sheet — precomputed derived fields (skill/2, skill/5).
- **Sanity as a resource with cascading thresholds:** San loss is usually a **dice roll** (e.g., "0/1D6"); lose **≥5 in a single roll → Temporary Insanity** (bout, gated by an INT roll); lose **≥ 1/5 of *current* Sanity in one day → Indefinite Insanity** (automatic); Sanity reaching 0 → permanent madness. Cthulhu Mythos skill caps max Sanity.
- **Luck** — a spendable pool (also a roll-under characteristic); spend Luck to push a failed roll up to success by buying the difference; refreshed by the Keeper.
- **Bonus / Penalty dice.** Roll one or more *extra* tens dice, keep the best (bonus) or worst (penalty) tens result — an advantage-cousin that operates on a single die of a d100.
- **Opposed rolls** — two characters' success levels compared (higher level, tiebreak by higher skill).
- **Pushing rolls** — reroll a failed roll once at narrative cost.
- **Combat:** Dodge / Fight Back are opposed skill rolls; damage = weapon dice + Damage Bonus die.
- **Improvement / experience checks:** ticked skills rolled at downtime; roll **> current skill** → skill increases by 1D10. (Inverse-direction check + growth.)
- **Age modifiers:** deduct points from physical characteristics and/or EDU by age band; add EDU-improvement checks.

### (2) Mapping table

| Mechanic | Our primitive / GAP |
|---|---|
| Characteristics STR…EDU (0–99) | ✅ base fields |
| HP = (CON+SIZ)/10 | ✅ formula (`floor((con+siz)/10)`) — **derived-stat-from-stats, computed once at creation but expressible on-read** |
| MP = POW/5, Sanity start = POW | ✅ formula |
| Max Sanity = 99 − Cthulhu Mythos | ✅ formula |
| Damage Bonus / Build from STR+SIZ band | ✅ `lookup` (threshold table on STR+SIZ) |
| MOV from STR/DEX vs SIZ three-way + age | ✅ nested `if()` + age lookup — expressible but ugly; fine |
| Skill half / fifth display values | ✅ formula (`floor(skill/2)`, `floor(skill/5)`) |
| d100 roll-under a skill | ❌ **GAP** — the *success test* is roll-**under** with the skill as the ceiling. Our dice field is opaque and our formulas produce scalars, not pass/fail against a roll. |
| Success levels (Regular/Hard/Extreme via skill, /2, /5; crit=01; fumble band) | ❌ **GAP** (signature) — **roll-under with divisor bands**. Degrees-of-success measured *downward* against one value and its integer fractions. No banded-outcome primitive at all. |
| Sanity resource | ⚠️ Partial — the *number* is session-state; ✅ storable |
| San loss = dice ("0/1D6") | ❌ **GAP** — loss is a **dice roll** applied to a resource (dice transform + resource mutation), engine never rolls. |
| ≥5 loss in one roll → Temporary Insanity | ❌ **GAP** — **cascading threshold on a *delta*** (magnitude of a single change), not on the resource's current value. Needs event/transition semantics. |
| ≥1/5 of *current* Sanity/day → Indefinite | ❌ **GAP** — threshold on **accumulated loss over a time window**, compared to a *fraction of the current* value. Stateful, temporal, self-referential. |
| Cthulhu Mythos caps Sanity | ✅ formula (already above) |
| Luck pool spend to buy success | ❌ **GAP** — spendable pool that *modifies a roll outcome after the fact*; interactive resource, not scalar. |
| Bonus / Penalty dice (extra tens, keep better/worse) | ❌ **GAP** — advantage-cousin on the tens die; dice-selection transform. (Same family as D&D advantage gap.) |
| Opposed rolls | ❌ **GAP** — outcome is a function of **two characters'** results; violates "own fields only." |
| Pushing rolls | ❌ **GAP** — reroll-with-consequence; state/event. |
| Improvement check (roll > skill → +1D10) | ❌ **GAP** — roll-**over** growth check + dice-driven mutation of a base field. |
| Age modifiers at creation | ⚠️ Partial — deductions expressible as formula/lookup, but "player allocates the deduction among stats" is an interactive creation-time choice we don't model. |

**Shared-with-D&D gaps present here:** no advantage/disadvantage (bonus/penalty dice), no degrees-of-success (the whole success-level system), no dice transforms (San loss, improvement), no random-table rolls, no rest/reset (Luck/MP/Sanity recovery), no array aggregation.

---

## (3) NEW PRIMITIVES these two systems demand

Prioritized. Each is something **neither D&D 5e nor PF2e-style d20 systems surfaced**, with a concrete recommendation. Items marked **[extends]** deepen a known D&D gap in a way that needs a *different* shape, not just the same fix.

**P1 — Banded roll-outcome primitive (declarative "check definition"), covering both roll-under-with-divisors and target-number degrees.**
The single highest-value gap; both systems are *built* on it and D&D only hinted at it.
Recommendation: introduce a **check descriptor** field type separate from the opaque dice field. It declares: `dice` (2d12, 1d100, d20), `compare` (`under` | `over` | `meet`), a `target` (a formula referencing character fields, e.g. the skill), and an ordered list of **outcome bands** defined as expressions over the target — e.g. CoC: `{critical: roll==1, extreme: roll<=target/5, hard: roll<=target/2, regular: roll<=target, fumble: roll>=fumble_floor}`. The engine still need not *roll*; it must be able to (a) render the bands/thresholds on the sheet ("Hard 12, Extreme 5") and (b) classify a supplied roll into a band. This one primitive absorbs CoC success levels, the skill/2 & skill/5 display fields, and D&D degrees-of-success.

**P2 — Asymmetric dice-pair with structured (multi-axis) outcome feeding a metacurrency.** [extends degrees + advantage]
Daggerheart's Duality is not advantage (keep-highest) and not a single band — it's *two dice with distinct identities* producing `(magnitude-band) × (which-die-higher | equal)`.
Recommendation: allow the P1 check descriptor to define **multiple named result dice** and **outcome axes** — an `outcome` axis (vs difficulty) and a `tone` axis (`hope` if dieA>dieB, `fear` if dieB>dieA, `crit` if equal) — plus **outcome→effect hooks** (`on: with_hope → gain(hope,1)`, `on: crit → gain(hope,1); clear(stress,1)`). This is the bridge into P6 (resource events).

**P3 — Damage-threshold band → track marks (banded lookup on an *external* input).** [extends]
Recommendation: a **band map** that takes a runtime input (incoming damage) rather than only the character's own fields, whose thresholds are formulas (`armor_minor + level`) and whose output is a small integer (1/2/3) written to a track. Effectively a lookup whose *key is a parameter*, not a field. Pair with an optional pre-band **reducer** (armor-slot spend shifts the input down one band).

**P4 — Resource pool with cascading, delta-and-fraction threshold effects (Sanity model).**
Sanity is the exemplar and nothing in d20 space needs it: thresholds fire on **(a) the magnitude of a single change** (≥5 → Temporary Insanity) and **(b) accumulated change over a time window vs a fraction of the current value** (≥ current/5 per day → Indefinite), in addition to (c) absolute floor (0 → permanent).
Recommendation: a **resource type** with `max` (formula), and a list of **threshold rules** each keyed on one of `{current_value, single_delta, windowed_delta}`, with the comparison target allowed to be a formula (`current/5`). Effects are named states the sheet can display/track. This subsumes Hope, Stress, Luck, MP as simpler cases.

**P5 — Tracks as bounded marked-slot arrays with state transitions (HP/Stress/Armor slots).** [extends rest/reset]
Distinct from a countdown integer: fixed slot count (a formula), mark/clear operations, "full → consequence," "last mark → death move," and **reset-on-rest**.
Recommendation: a **track** field: `slots` (formula for count), `state` (session-state bitset/count), declarative `on_full` / `on_last` hooks, and a `reset_on` trigger (short rest / long rest / session / downtime day). The `reset_on` trigger also serves CoC Luck/MP recovery and closes the shared no-rest gap for all systems at once.

**P6 — Outcome-triggered and cross-character resource events (metacurrency economy + opposed/assist).**
Hope/Fear gains, "spend Hope to activate an Experience," Luck spent to buy success, Rally/tag-team transfers, and opposed/assist rolls all break "deterministic scalar from the character's *own* fields."
Recommendation: a lightweight **event/effect layer**: `gain/spend(resource, amount)` hooks attached to check outcomes (from P2) and to card/feature activations, plus a **multi-actor check** mode where a resolution reads two characters' P1 results and returns a comparison. This is explicitly *outside* the pure-scalar engine — flag it as a new subsystem, not a formula extension.

**P7 — Conditional/optional modifier gated on adjudication + cost (Experiences; also CoC pushing).**
A `+2` that applies only when the GM rules it relevant and only if you pay 1 Hope.
Recommendation: an **optional-modifier** descriptor: `value` (formula), `applies_when: manual` (player/GM toggle), optional `cost: spend(resource,n)`. Combined with **typed-modifier stacking** (the known D&D gap) so multiple such bonuses resolve by a stacking rule.

**P8 — Dice-driven mutation of fields (dice transforms in service of state).** [extends dice-transform gap]
San loss `0/1D6`, improvement checks awarding `+1D10`, damage `[prof]d[die]` where the dice *count is a computed field*.
Recommendation: (a) let dice-expression fields **template computed operands** (`{proficiency}d{weapon_die}`) so the shown average tracks the derived count; (b) allow a check outcome to apply a **dice-result delta** to a resource/base field via the P6 event layer. The engine still doesn't roll — it accepts the rolled value and routes it.

**P9 — Roll-over growth / improvement check.** (Lower priority; CoC-specific but structurally novel.)
"Roll > current skill → increase by 1D10" is a check whose *success mutates a base field upward at downtime*.
Recommendation: falls out of P1 (`compare: over`) + P5's `reset_on: downtime` trigger + P8's dice-delta mutation — no new primitive if P1/P5/P8 land, so note it as validation that those three compose.

---

### Bottom line
Our grammar cleanly handles **derived-stat-from-stats** (CoC HP/MP/Sanity/Build/MOV are all just formulas + lookups — a genuine strength, no gap there) and **banded scaling on the character's own value** (tiers, thresholds-as-values). It **cannot express**, in rough priority: (1) **banded roll outcomes / degrees of success**, including CoC's roll-under-with-divisors and Daggerheart's asymmetric dual-die tone; (2) **resources with event-, delta-, and fraction-triggered cascading thresholds** (Sanity above all); (3) **tracks as reset-able marked-slot state machines**; (4) **outcome-triggered metacurrency economies and cross-character resolution**. Daggerheart breaks us on the *outcome/economy* axis; Call of Cthulhu breaks us on the *success-banding* and *sanity-cascade* axes. Together they justify promoting the engine from "pure on-read scalar calculator" to "scalar calculator **+** a declarative check-outcome/resource-event layer."

**Sources:** [Damage Threshold — Daggerheart Nexus](https://app.demiplane.com/nexus/daggerheart/rules/damage-threshold), [Marking Hit Points — Daggerheart Wiki](https://daggerheart.fandom.com/wiki/Marking_Hit_Points), [Sanity (SAN) — Call of Cthulhu RPG Wiki (Chaosium)](https://cthulhuwiki.chaosium.com/rules/sanity.html), [System Rules: Call of Cthulhu 7th — TRPGLine](https://trpgline.com/rules/coc7/sanity).
