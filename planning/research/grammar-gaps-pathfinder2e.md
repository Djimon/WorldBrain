# System-Plugin Grammar — Pathfinder 2e (Remaster) Completeness Analysis

> Research-Artefakt (Sub-Agent, 2026-07-07). Teil der M6↔M9-Grammatik-Vollständigkeitsprüfung (#225).
> Zweck: PF2e-Mechaniken finden, die unsere D&D-abgeleitete Grammatik NICHT ausdrücken kann — damit wir keine D&D-only-Grammatik bauen.
> Verwandte Reports: [D&D 5e](grammar-gaps-dnd5e.md), [Daggerheart](grammar-gaps-daggerheart.md), [Call of Cthulhu](grammar-gaps-call-of-cthulhu.md).

Scope: identify Pathfinder 2e (Remaster) mechanics that our D&D-derived grammar **cannot** express. PF2e is a much heavier computational system than 5e — nearly every roll is `d20 + level + proficiency-rank-bonus + ability + item + status/circumstance modifiers`, resolved against a **banded outcome** (four degrees of success). This structure alone breaks several assumptions baked into our current primitives.

---

## (1) PF2e Mechanics Inventory (computational surface only)

### 1.1 Proficiency ranks (the spine of the whole system)
Every attack, save, skill, Perception, AC, spell, and class DC has a **proficiency rank**: untrained / trained / expert / master / legendary. The bonus is:

- Untrained: **+0** (level is NOT added)
- Trained: **level + 2**
- Expert: **level + 4**
- Master: **level + 6**
- Legendary: **level + 8**

So the rank contributes `level + (2 × tier)` where tier ∈ {1,2,3,4}, **except untrained which is a flat 0 (no level)**. This is a conditional-with-discontinuity, not a smooth lookup. (Optional variant "Proficiency without Level" drops the `+ level` term — a plugin-level toggle.)

Rank is stored per-statistic (e.g. `perception_rank`, `fortitude_rank`, `athletics_rank`, `longsword_rank`, `class_dc_rank`, `spell_rank`). Dozens of these fields.

### 1.2 Standard statistic assembly (the universal formula)
Nearly every derived number is:

```
modifier = ability_mod + proficiency_bonus(rank, level) + item_bonus + status_bonus + circumstance_bonus - penalties
```

- **AC** = `10 + Dex_cap(dex_mod, armor_dex_cap) + ac_proficiency(rank,level) + armor_item_bonus + status + circumstance`
- **Save** = `level + rank_bonus + ability_mod + item + status + circ` (Fort=Con, Ref=Dex, Will=Wis)
- **Class DC** = `10 + level + class_dc_rank_bonus + key_ability_mod + item`
- **Spell attack** = `level + spell_rank_bonus + spellcasting_ability_mod + item`; **Spell DC** = `10 + ` same.
- **Skill** = `level + skill_rank_bonus + ability_mod + item + status + circ - penalties`

Note the **Dex cap**: AC adds `min(dex_mod, armor_dex_cap)` — an armor-dependent clamp. Expressible with `min()`. Good.

### 1.3 Four degrees of success (banded outcomes)
Compare `roll_result` vs `DC`:
- `≥ DC + 10` → **critical success**
- `≥ DC` (and `< DC+10`) → **success**
- `< DC` (and `> DC−10`) → **failure**
- `≤ DC − 10` → **critical failure**

Then the **natural-die step shift**: nat 20 shifts the result **one degree better**; nat 1 shifts **one degree worse** (applied *after* the numeric band, and clamped at the ends). This is the resolution model for *every* check in the game — attacks, saves, skills, spells. Damage, conditions applied, and narrative all key off which of the four bands you land in (e.g. basic saves: crit-success = 0 dmg, success = half, failure = full, crit-failure = double).

### 1.4 Three-action economy + Multiple Attack Penalty (MAP)
Each turn = **3 actions** (+ 1 reaction). Attacking multiple times in a turn incurs a cumulative penalty:
- 2nd attack: **−5**, 3rd+: **−10**
- Agile weapon: **−4 / −8**

MAP is a per-turn *sequence* penalty (attack index → penalty), reset each turn. It is transient in-play state, not a stored field, and depends on "how many attacks so far this turn."

### 1.5 Valued conditions (numeric, cross-cutting, some auto-decrementing)
PF2e conditions carry an integer value N that applies a **status penalty (or bonus) equal to N** to a *category* of rolls, and often to derived stats. Key ones:
- **Clumsy N** → −N to all Dex-based checks & DCs (AC, Reflex, ranged attacks, Acrobatics/Stealth/Thievery).
- **Enfeebled N** → −N to Str-based rolls/DCs (melee attack, Str damage, Athletics).
- **Drained N** → −N to Con-based rolls (Fort saves); **also** reduces current AND max HP by `level × N`.
- **Stupefied N** → −N to Int/Wis/Cha checks/DCs, spell attack, spell DC, and adds a flat-check DC to cast.
- **Frightened N** → −N to **all** checks and DCs; **auto-decreases by 1 at end of each of your turns** (a per-turn state transition).
- **Sickened N** → −N to all checks/DCs; can't willingly ingest.
- **Doomed N** → reduces the dying value at which you die (`dying_max = 4 − doomed`); decreases by 1 per full rest.
- **Wounded N** → increases the dying value you gain when you fall again.
- **Slowed N / Quickened** → −N (or +1) to actions available this turn.
- **Off-guard** → flat −2 circumstance to AC.

Conditions are **session-state fields**, but their *effects fan out into many derived formulas simultaneously* (one condition value feeds a dozen fields), and several **auto-mutate** (frightened −1/turn, doomed/wounded on rest/dying transitions).

### 1.6 Level-based DC tables + adjustments
Setting a DC by level or by spell rank uses a **table** (Level 0 = DC 14, … it's a per-level lookup, roughly `14 + level` with a documented irregular curve for high levels, plus rank-based bumps). Difficulty **adjustments** are a second table: Incredibly Easy −10, Very Easy −5, Easy −2, Hard +2, Very Hard +5, Incredibly Hard +10. Simple 1D thresholds/exact lookups — fine.

### 1.7 Character build math
- **Ability boosts/flaws**: at creation and at levels 5/10/15/20 you apply four **+2 boosts** (a boost pushing an 18→19 gives only **+1** — a partial boost above 18), plus ancestry flaws (−2). Final score → modifier `floor((score−10)/2)`. The boost accounting is an aggregation over a list of boost/flaw sources with an above-18 special case.
- **HP** = `ancestry_HP + (class_HP + Con_mod) × level` — a per-level accumulation of a Con-dependent term.
- Skill increases, attribute apex items, etc.

### 1.8 Focus, Hero Points, Shields, Bulk, exploration
- **Focus points**: pool of **1–3** (cap 3), spent to cast focus spells, refocused on rest. Session-state counter with a cap and a spend/refill cycle.
- **Hero points**: gained per session, spent to reroll or avoid death. Session-state counter, resets per session.
- **Shield block**: shield has **Hardness / HP / Break Threshold (BT = HP/2)**. When you Raise a Shield and block, damage is reduced by Hardness; the shield takes `damage − Hardness`; if shield HP drops below BT it's broken, at 0 destroyed. Stateful, thresholded, with a subtract-and-track loop.
- **Bulk / encumbrance**: sum item Bulk (L = 0.1, coins etc.); **encumbered if total > 5 + Str_mod**, **max = 10 + Str_mod**. Encumbered → clumsy 1 + −10 ft speed. Requires **array aggregation (sum of Bulk over carried items)** then a threshold.
- **Dying / Wounded / Recovery**: `dying` counter 1–4; at 4 you die; recovery check is a flat DC `10 + dying_value`; wounded adds to dying gained. State machine.

### 1.9 Creatures / monsters
- Monster stats are set by **level-based benchmark tables** (High/Moderate/Low columns per level for AC, attack, saves, HP, DC, damage). A stat block picks a column → 2D lookup (level × role-tier).
- **Weaknesses / Resistances with values**: e.g. "Resistance 5 to physical (except silver)", "Weakness 10 to fire". Damage of a type is reduced/increased by the value, with **type-matching and exception clauses**. This is post-roll *damage modification*, not a character scalar.
- **Immunities**, regeneration (with deactivating damage types).

---

## (2) Mapping table: mechanic → our primitive OR **GAP**

| PF2e mechanic | Our primitive | Verdict |
|---|---|---|
| Standard modifier assembly (ability+item+etc.) | `formula` (+ − chaining) | **Expressible** |
| AC Dex-cap `min(dex, cap)` | `formula` (`min`) | **Expressible** |
| Ability modifier `floor((score−10)/2)` | `formula` (`floor`) | **Expressible** |
| Proficiency rank bonus (trained=lvl+2 … legendary=lvl+8) | `lookup` (rank→2/4/6/8) + `formula` (`+level`) | **Expressible but awkward** — needs the *untrained=0, no level* discontinuity via `if(rank==0, 0, level + tierbonus)`. Doable with ternary + lookup, but repeated across ~30 stats → begs a dedicated primitive. |
| Level/spell-rank/creature DC tables | `lookup` (threshold/2D) | **Expressible** |
| Difficulty adjustment (±2/±5/±10) | `formula`/`lookup` | **Expressible** |
| HP = ancestry + (classHP+Con)×level | `formula` | **Expressible** |
| **Four degrees of success (banded outcome vs DC)** | — | **GAP** — no banded/threshold-to-category output; our engine returns scalars only. |
| **Nat-20/nat-1 step shift** | — | **GAP** — no die-face awareness; ties to the dice-vs-outcome gap (already known from D&D advantage, but PF2e makes it structural, not optional). |
| **Multiple Attack Penalty (attack index → −5/−10, agile −4/−8)** | — | **GAP** — per-turn sequence state; no "attack number this turn" concept. Shares the "no per-turn transient state" gap. |
| **Valued conditions fanning into many stats** | session-state field + N formulas | **Partial / GAP** — the *value* is a session-state int (fine), but there is no "one condition contributes a typed **status penalty** to a whole *category* of stats" mechanism. You'd hand-wire clumsy into AC, Reflex, ranged-attack, 3 skills… × every condition. This is the **typed-modifier-stacking gap** (known from D&D) but PF2e makes it central and *valued*. |
| **Frightened auto −1/turn; doomed/wounded on rest** | — | **GAP** — no state-transition/reset rules (known D&D gap: rest/reset). PF2e adds *per-turn auto-decrement* and *event-triggered* transitions (on-dying). |
| Ability boosts (four +2, +1-above-18, flaws) | — | **GAP (aggregation + special case)** — needs sum over a boost/flaw list with a conditional cap rule. Array-aggregation gap. |
| **Bulk total → encumbered/max thresholds** | — | **GAP** — requires `sum(Bulk)` over carried `ref[]` (array aggregation, known D&D gap) then threshold. |
| Focus points (cap 3, spend/refocus) | session-state counter | **Partial** — value stores fine; the **cap + refill-on-rest** cycle has no primitive. |
| Hero points (per-session reset) | session-state counter | **Partial** — same reset-transition gap. |
| **Shield block (Hardness reduce, HP track, BT broken/destroyed)** | — | **GAP** — stateful subtract-and-threshold with a broken/destroyed state machine; not a read-only scalar. |
| **Dying/wounded/recovery state machine** | — | **GAP** — multi-state counter with event transitions and a derived recovery DC. |
| **Weakness/Resistance with values + type match** | — | **GAP** — post-hoc *damage-instance* modification keyed on damage type with exceptions; our engine has no damage-instance object, only character scalars. |
| Creature benchmark tables (level × role) | `lookup` 2D | **Expressible** |
| Multiclass (Free Archetype / dedication feats) | single-`class` schema | **GAP** (shared with D&D) — PF2e archetypes are additive feat chains rather than 5e-style level splitting, but still exceed a single class field. |

---

## (3) NEW primitives PF2e demands that D&D didn't surface (prioritized)

These are the ones where PF2e reveals a *structural* need the D&D pass didn't force. Ordered by leverage (how many PF2e mechanics each unlocks).

### P1 — **Banded-outcome / degrees-of-success primitive** (highest leverage)
**Why:** This is the resolution model of the entire game; without it a PF2e plugin can't express what any roll *does*.
**Recommendation:** Add a derived field type `bands` (or `degrees`): given an input value and a DC (both may be formulas/fields), return one of an ordered set of named bands by threshold offsets. Default PF2e config:
```
band(input=roll_result, dc, thresholds=[+10, 0, -10])
  → crit_success | success | failure | crit_failure
```
Generalize to N bands so other systems (Blades' 6/4-5/1-3, PbtA 10+/7-9/6−) reuse it. Pair each band with an optional **step-shift** input (`+1` on nat 20, `−1` on nat 1) that moves the result one band and clamps. Note: since the engine deliberately doesn't roll dice, the "roll_result" is a user-supplied/clicked input — the primitive computes *which band a given total lands in*, and the plugin declares per-band effects (e.g. basic-save damage multipliers 0/0.5/1/2). This makes bands a **first-class output type** alongside scalar.

### P2 — **Valued-condition modifier system** (typed status/circumstance modifiers driven by a condition value)
**Why:** PF2e conditions are the primary way stats change in play, they are *valued*, they use PF2e's **bonus-stacking rule** (take only the highest of each type: status / circumstance / item), and one value feeds many stats.
**Recommendation:** Two coupled features:
1. A **modifier declaration**: a source (condition, item, spell) declares `{target_category, type: status|circumstance|item, value}`. Categories are named tag-sets (e.g. `dex_based = [ac, reflex, ranged_attack, acrobatics, stealth, thievery]`). A derived stat sums the **max per type** of all modifiers whose category includes it. This directly implements both the "one condition → many stats" fan-out *and* the **typed-modifier-stacking** gap already flagged from D&D — PF2e makes it non-optional and quantified.
2. **Condition value = session-state int** feeding those modifiers (`clumsy: N` → status −N to `dex_based`). Frightened contributes to the universal `all_checks` category.

### P3 — **Tiered proficiency-rank primitive**
**Why:** ~30 stats per sheet use it; the untrained discontinuity (no level added) is a foot-gun if hand-written every time.
**Recommendation:** A small dedicated helper: `proficiency(rank_field, level)` returning `rank==untrained ? 0 : level + {trained:2,expert:4,master:6,legendary:8}[rank]`, with a plugin flag `add_level: true|false` (for the "Proficiency without Level" variant). Effectively a *rank enum → bonus* lookup fused with the conditional level term. Cheap to add, huge ergonomics win, and prevents every plugin author re-deriving the untrained edge case.

### P4 — **Array aggregation over `ref[]`/embedded lists** (`sum` / `count` / `max`)
**Why:** Bulk/encumbrance needs `sum(item.bulk)`; also enables counting prepared spells, summing coin weight, counting invested items (PF2e caps invested magic items at 10). Same primitive D&D flagged, but PF2e gives concrete, common formulas.
**Recommendation:** Aggregation functions in the formula grammar that fold over a `ref[]`/embedded array field extracting a numeric sub-field: `sum(carried, 'bulk')`, `count(spells_prepared)`, `max(...)`. Then encumbrance is `sum(carried,'bulk') > 5 + str_mod`.

### P5 — **State-transition / reset rules** (per-turn, per-rest, per-session, event-triggered)
**Why:** Frightened −1/turn, focus refocus on rest, hero points reset per session, wounded/doomed decrement on rest, MAP reset each turn. D&D surfaced only "rest/reset"; PF2e needs **multiple named reset scopes** and **auto-decrement**.
**Recommendation:** Declarative transition rules on session-state fields: `{on: turn_end|rest|session_start|daily_prep, action: decrement|set(x)|clamp|refill_to(cap)}`. Covers frightened auto-decrement, focus-point refill (`refill_to(focus_cap)`), hero-point reset, and gives MAP a home if attack-index is modeled.

### P6 — **Counter with cap + spend/refill semantics** (focus points, hero points, shield HP)
**Why:** These are bounded resources, not free scalars; the cap and refill are part of the rule.
**Recommendation:** A `resource` session-state type: `{current, max (may be a formula, e.g. focus_cap), min:0}` with `spend`/`restore`/`refill` operations, clamped to `[min,max]`. Shield HP reuses this with `max = shield_hp`, and a **derived broken/destroyed state** via a band on `current` vs `BT` (`BT = floor(shield_hp/2)`) — i.e. P1 and P6 compose to model shields.

### P7 — **Damage-instance modification (weakness/resistance with type + exceptions)** — plugin-boundary decision
**Why:** Weakness/Resistance operate on a *damage packet* (has amount + type), not a character scalar. This is outside "deterministic scalar from the character's own fields."
**Recommendation:** Decide scope explicitly. If WorldBuilderX only ever renders sheets (not resolves damage), model weaknesses/resistances as **read-only declared data** (`{type, value, kind: weakness|resistance, except:[…]}`) shown on the sheet, and let the GM apply them — no engine change. If you ever want the engine to *apply* damage, you need a new evaluation context (a damage-instance object with a type tag) that the current scalar-only engine doesn't have. Recommend: **declared data now, defer the engine.** Same call applies to MAP if you don't model in-turn attack sequences.

---

### Bottom line
Our grammar handles PF2e's *static* sheet math (modifier assembly, DCs, HP, ability mods, level/creature tables) well. It **cannot** express PF2e's three defining structures: **(a) banded degree-of-success outcomes** (P1), **(b) valued, category-spanning, type-stacked condition/modifier system** (P2), and **(c) stateful in-play transitions** — auto-decrementing conditions, resource caps/refills, shield HP, dying track (P5/P6). It also re-confirms and *sharpens* three known D&D gaps into concrete must-haves: typed-modifier stacking (now *valued*), array aggregation (Bulk), and rest/reset (now *multi-scope*). The tiered-proficiency helper (P3) is low-cost, high-ergonomics. Building P1+P2 is the difference between a PF2e-capable grammar and a D&D-only one.

**Sources:**
- [Proficiency — Archives of Nethys](https://2e.aonprd.com/Rules.aspx?ID=3305)
- [Step 4: Determine the Degree of Success — Archives of Nethys](https://2e.aonprd.com/Rules.aspx?ID=2286)
- [Conditions — Archives of Nethys](https://2e.aonprd.com/Conditions.aspx)
- [Proficiency without Level — Archives of Nethys](https://2e.aonprd.com/Rules.aspx?ID=1370)
