# System-Plugin Grammar — Call of Cthulhu 7e Completeness Analysis (dedicated)

> Research-Artefakt (Sub-Agent, 2026-07-07). Teil der M6↔M9-Grammatik-Vollständigkeitsprüfung (#225).
> Zweck: CoC 7e (percentile roll-under, sanity-driven) tief prüfen — der stärkste Test, ob die Grammatik wirklich resolution-model-agnostisch ist. Enthält eine System-Konvergenz-Matrix über alle vier Systeme.
> Verwandte Reports: [D&D 5e](grammar-gaps-dnd5e.md), [Pathfinder 2e](grammar-gaps-pathfinder2e.md), [Daggerheart](grammar-gaps-daggerheart.md).

CoC 7e is a **percentile roll-under, skill-based, sanity-driven** system. The whole resolution model inverts the d20 assumption: you succeed by rolling **at or below** a target, and every skill/characteristic *is* its own success chance. This is the strongest stress test yet for whether the grammar is truly resolution-model-agnostic, because our derived-field engine only computes deterministic scalars and never reasons about the roll — but CoC's core scalar (the skill value) is *simultaneously* a target number, a set of banded thresholds, and an improvement candidate.

---

## (1) CoC 7e Mechanics Inventory (mechanics only)

### 1.1 Core resolution: d100 roll-under
- Roll d100 (percentile). **Roll ≤ skill value = success.** The skill number *is* the success probability. There is no separate "target number" field; the field being tested is the target.
- No summing, no roll-over, no fixed DC. Difficulty is applied by **which threshold of the same skill** you must beat (see success levels), not by changing a DC.

### 1.2 Success levels — banding ONE scalar into tiers
For a skill value `S` and a roll `r`:
- **Critical:** `r == 01` (always, regardless of S).
- **Extreme success:** `r ≤ floor(S/5)`.
- **Hard success:** `r ≤ floor(S/2)`.
- **Regular success:** `r ≤ S`.
- **Failure:** `r > S`.
- **Fumble:** if `S < 50` → `r` in `96–100`; if `S ≥ 50` → `r == 100` only. (Fumble band widens when skill < 50.)

The three success thresholds `S`, `floor(S/2)`, `floor(S/5)` are pure deterministic scalars derived from one field. The **fumble threshold is itself a conditional derived scalar** (`if(S<50, 96, 100)`).

### 1.3 Characteristics (0–99 roll-under scale)
STR, CON, SIZ, DEX, APP, INT, POW, EDU. Generated as `3d6×5` (STR/CON/DEX/APP/POW) or `(2d6+6)×5` (SIZ/INT/EDU). Each is also directly rollable as a roll-under target, with the same hard/extreme banding as skills.

### 1.4 Derived attributes (computed from characteristics at creation)
- **Hit Points:** `HP = floor((CON + SIZ) / 10)`.
- **Magic Points:** `MP = floor(POW / 5)`.
- **Sanity (starting):** `SAN_start = POW`. Current SAN is a separate mutable resource.
- **Dodge:** `Dodge = floor(DEX / 2)` (a skill, and also improvable).
- **Move (MOV):** stepwise comparison:
  - both DEX < SIZ **and** STR < SIZ → `MOV = 7`
  - DEX > SIZ **and** STR > SIZ → `MOV = 9`
  - otherwise (including all-equal) → `MOV = 8`
  - **Age modifier:** −1 to MOV per full decade over 30s (40s: −1, 50s: −2, …).
- **Damage Bonus (DB) & Build:** **band lookup on `STR + SIZ`**:
  | STR+SIZ | Damage Bonus | Build |
  |---|---|---|
  | 2–64 | −2 | −2 |
  | 65–84 | −1 | −1 |
  | 85–124 | 0 (none) | 0 |
  | 125–164 | +1d4 | +1 |
  | 165–204 | +1d6 | +2 |
  | 205–284 | +2d6 | +3 |
  | 285–364 | +3d6 | +4 |
  | 365–444 | +4d6 | +5 |
  | +80 each further step | +1d6 | +1 |

  Note DB **outputs a dice expression** (`+1d4`, `+2d6`) for some bands and a flat number for others — the *output type varies per band*. Build outputs a scalar used in combat maneuvers/opposed grappling.

### 1.5 Sanity — resource with cascading threshold effects
- Resource 0–99: **current SAN** vs **starting SAN**. Mutable in play.
- **San loss:** each frightening source specifies a loss like "`0/1d6`" (0 if you make a SAN roll, `1d6` if you fail). The San roll is a roll-under vs current SAN.
- **Temporary insanity:** lose **≥ 5 SAN from a single source/roll** → temporarily insane.
- **Indefinite insanity:** lose **≥ 1/5 of current SAN within one game session** (a running-total threshold across the session).
- **Max SAN cap:** `SAN_max = 99 − Cthulhu Mythos skill`. Rising Mythos *lowers* the ceiling.
- **Permanent madness / dead-inside:** SAN reaches **0**.
- SAN recovers slowly (therapy, overcoming Mythos threats) — asymmetric, non-resetting.

### 1.6 Luck — spendable resource pool
- **Luck** is a rolled pool (`3d6×5` or points). Two uses:
  - **Push a failed roll's margin down:** spend Luck point-for-point to *reduce your roll result* to ≤ skill and convert a failure into a success (cannot buy a fumble→success).
  - Also usable as a straight **Luck roll** (roll-under current Luck) for chance events.
- Luck spent is deducted; regained rarely (GM award) — asymmetric to spending.

### 1.7 Bonus / penalty dice (structural cousin of advantage)
- **Bonus die:** roll an **extra tens die**, keep the **more favorable** (lower) tens result.
- **Penalty die:** roll extra tens die, keep the **less favorable** (higher) result.
- Multiple can stack; they cancel pairwise (one bonus + one penalty = none). This modifies the *roll*, not the target.

### 1.8 Pushing rolls
- After a failed regular roll, the player may **re-attempt once** by justifying extra effort, accepting that failure now carries a **narrative/mechanical consequence**. Structurally: a conditional reroll gated on prior failure, with a consequence branch.

### 1.9 Opposed rolls
- Two parties each roll their skill/characteristic; **higher success level wins**; tie broken by higher skill value. Requires comparing *success tiers*, not raw numbers.

### 1.10 Skill improvement checks
- On any **successful** use in play, tick a **"check" flag** next to that skill (a per-skill boolean session-state).
- At scenario/downtime end, for each ticked skill roll d100; if `roll > skill` (fail a roll-**over** here), the skill **increases by `1d10`**. Ticks then clear. This is a state-transition (improvement phase) with an inverted roll condition and a random increment.

### 1.11 Combat specifics
- **Fighting/Firearms** are ordinary roll-under skills.
- **Damage:** weapon dice **+ Damage Bonus** (which may itself be dice). Firearms usually ignore DB.
- **Armor:** flat **subtract** from damage after the hit.
- **Major wound:** single hit ≥ `floor(max HP / 2)` → major wound (prone, CON roll to stay conscious, possible dying).
- **Dodge / fighting back** = opposed roll; firearms can't normally be dodged.

---

## (2) Mapping table: mechanic → grammar primitive OR GAP

| CoC mechanic | Grammar primitive | Verdict |
|---|---|---|
| Characteristics as base fields | `base` typed numeric fields | ✅ Expressible |
| Characteristic generation `3d6×5` / `(2d6+6)×5` | dice field is display-only; creation randomization not modeled | ⚠️ Partial |
| HP `floor((CON+SIZ)/10)` | `formula` w/ `floor`, `+`, `/` | ✅ Expressible |
| MP `floor(POW/5)`, Dodge `floor(DEX/2)` | `formula` | ✅ Expressible |
| Starting SAN = POW | `formula` (copy) | ✅ Expressible |
| MOV stepwise DEX/STR vs SIZ | `formula` w/ nested `if` + `and`/comparisons | ✅ Expressible (verbose but fits) |
| MOV age modifier (−1/decade over 30) | `formula` `floor((age-30)/10)` clamped ≥0 | ✅ Expressible (needs `max(0,…)`) |
| **Damage Bonus & Build from STR+SIZ bands** | `lookup` **threshold** mode, key = `STR+SIZ` | ✅ mostly — **but** DB output is *sometimes a dice string, sometimes a number* → lookup would need **heterogeneous typed values**. Build is clean scalar. ⚠️ **partial GAP: table cell returning a dice expression** |
| Success target = the skill value | field *is* the target; nothing marks a field as "roll-under target" | 🔶 **GAP: no roll-under target-number concept** |
| Hard/Extreme thresholds `floor(S/2)`, `floor(S/5)` | derivable as `formula` fields | ✅ the *scalars* compute; ❌ but they aren't tied to roll semantics |
| **Success levels banding** | none — engine returns a scalar, never a band-vs-roll outcome | 🔴 **GAP: degrees-of-success banding** (CoC *requires* it) |
| Fumble threshold `if(S<50,96,100)` | `formula` conditional → computes the scalar fine | ✅ scalar computes; 🔴 consuming it as a roll band = GAP |
| **SAN as current-vs-start resource** | `session-state` field | ✅ storage; ❌ no threshold-effect logic |
| SAN loss `0/1d6` (roll-gated dice) | dice field can't branch on a SAN-roll result | 🔴 **GAP: conditional/gated dice + roll-driven state change** |
| **Temp insanity: ≥5 loss in one roll** | no event/delta-trigger primitive | 🔴 **GAP: single-event delta threshold** |
| **Indefinite insanity: ≥1/5 loss per session** | no session-cumulative tracking | 🔴 **GAP: session-cumulative threshold** |
| **Max SAN = 99 − Mythos** | `formula` caps a *derived* max; current SAN is session-state | 🔶 **GAP: derived cap constraining a mutable resource** |
| Permanent madness at SAN 0 | threshold effect | 🔴 GAP (same family) |
| **Luck pool spend to buy success** | `session-state` scalar for the pool | ✅ storage; ❌ spend-mechanic out of scope |
| **Bonus/Penalty dice** | none | 🔴 **GAP** (cousin of advantage/disadvantage) |
| Pushing rolls (gated reroll + consequence) | none | 🔴 GAP (reroll model) |
| Opposed rolls (compare success tiers) | none | 🔴 GAP (needs banding first) |
| **Skill improvement check (tick + later 1d10 grow)** | per-skill boolean = session-state; increment out of scope | 🔴 **GAP: state-transition/growth phase** |
| Damage = weapon dice + DB | dice field is display-only; can't compose two dice sources | ⚠️ Partial (dice transforms gap) |
| Armor = flat subtract | `formula` if damage were a field; but damage is transient | 🔶 GAP (transient combat values aren't sheet fields) |
| Major wound: hit ≥ `floor(maxHP/2)` | `floor(maxHP/2)` computes as a threshold scalar | ✅ scalar computes; ❌ the "was this hit ≥ threshold" event = GAP |

---

## (3) NEW primitives CoC 7e demands (prioritized)

### P1 — Roll-under target-number semantics *(new; CoC-defining)*
**Problem:** Our derived fields are pure scalars with no resolution meaning. CoC's skill value simultaneously is a **target you roll under**.
**Recommendation:** Add a lightweight **`roll-target` field descriptor** (a flag/annotation, not an evaluator): `{ target: <fieldRef>, direction: "under" | "over", die: "1d100" }`. The engine still doesn't roll/reason; it just knows "this field is the number a d100 is compared against, direction under." Generalizes: D&D is `direction:"over"` vs a DC; CoC is `under` vs the skill itself. **One primitive covers both roll-over and roll-under systems.**

### P2 — Divisor-band / degrees-of-success primitive *(the CoC keystone; OVERLAPS D&D & PF2e)*
**Problem:** Success **levels** are the heart of CoC (extreme/hard/regular) *and* PF2e (crit-success/success/failure/crit-fail by ±10) *and* D&D-adjacent nat-20/nat-1.
**Recommendation:** A **`success-bands` descriptor** attached to a `roll-target`, expressed declaratively as ordered thresholds referencing the target field:
```
bands (roll-under):
  critical: roll == 1
  extreme:  roll <= floor(target/5)
  hard:     roll <= floor(target/2)
  regular:  roll <= target
  fail:     else
  fumble:   roll >= if(target<50, 96, 100)
```
The band bounds are already expressible with our formula grammar — so the primitive is just "ordered named formula-thresholds compared to a roll." **The single highest-leverage new primitive and the one most shared across all four systems. Converge here — do not build per-system.**

### P3 — Band-table lookup returning heterogeneous/typed cells *(extends existing `lookup`)*
**Problem:** Damage Bonus & Build is exactly our 1D `threshold` lookup on `STR+SIZ` — *except* DB cells are sometimes scalar and sometimes a **dice expression**.
**Recommendation:** Allow `tables/*.json` cells to hold a **typed union** (`{type:"scalar"|"dice", value:...}`), and let a lookup field declare its return type as `dice`. Small, contained extension. (D&D cantrip-damage-by-level and PF2e tables want the same → shared.)

### P4 — Derived-stat-from-stats at creation *(largely ALREADY expressible — validate, don't build)*
HP, MP, SAN-start, Dodge, MOV all reduce to `formula`/nested-`if`. The only real gap: **starting SAN and Luck must "snapshot" a derived value into a mutable session-state resource** at creation, then diverge.
**Recommendation:** Add a **`seed` relationship**: a `session-state` field may declare `seedFrom: <formula/field>` = "initialize from this derived value at creation, mutable thereafter." Covers SAN (seed POW), Luck, and D&D's "current HP seeded from max HP." **Shared with every current-vs-max resource.**

### P5 — Resource pool with cascading threshold effects *(CoC Sanity exemplar; OVERLAPS D&D/DH heavily)*
**Problem:** Sanity needs: (a) a **derived max cap** (`99 − Mythos`) constraining the mutable value; (b) a **single-event delta trigger** (≥5 → temp insanity); (c) a **session-cumulative delta trigger** (≥1/5 → indefinite); (d) a **zero-floor terminal state**.
**Recommendation:** A **`resource` primitive**:
```
resource sanity:
  seedFrom: POW
  max: formula(99 - mythos)
  min: 0
  triggers:
    - when: delta_single <= -5  -> flag(temporaryInsanity)
    - when: delta_session <= -(0.2 * session_start) -> flag(indefiniteInsanity)
    - when: value == 0 -> flag(permanentMadness)
```
The engine tracks `delta_single`, `delta_session`, `session_start`. **Most novel primitive but pays off across systems:** D&D death-saves/HP-zero, DH stress/hope, PF2e dying/wounded all fit "resource + threshold-triggered flags." **Strongly converge.**

### P6 — Bonus/Penalty dice (roll-modifier keep-best/worst) *(OVERLAPS D&D advantage, DH)*
**Recommendation:** Generalize the D&D-motivated **`roll-modifier` primitive**: `{kind:"extra-die", pool:"tens", keep:"best"|"worst", stacking:"cancel-pairwise"}` alongside advantage `{kind:"keep", of:2, keep:"best"}`. **One primitive, all systems.**

### P7 — Gated / roll-driven dice and rerolls *(pushing rolls, SAN "0/1d6"; OVERLAPS DH, D&D)*
**Recommendation:** Extend dice/roll descriptors with **outcome-conditional payloads** (`onSuccess`/`onFailure: <dice>`) and a `reroll:{allowedOnce, condition, consequence}` annotation. Lower priority; the San-loss gated dice warrants the conditional-payload half.

### P8 — Growth/state-transition phase (skill improvement checks) *(OVERLAPS D&D rest-reset gap)*
**Recommendation:** Reuse the **state-transition / reset primitive** (from the D&D rest gap): a named **phase** iterating fields matching a predicate applying a declarative delta (`+roll(1d10)` conditioned on `roll(1d100) > skill`). **Converge with rest-reset — same primitive, different trigger.**

---

## Convergence summary (shared vs CoC-specific)

| New primitive | CoC | D&D 5e | PF2e | Daggerheart | Verdict |
|---|---|---|---|---|---|
| P1 roll-target (under/over) | ★ core | ✔ | ✔ | ✔ | **Shared** |
| P2 success-bands / degrees-of-success | ★ core | ~ (nat20/1) | ★ core | ★ (hope/fear) | **Shared — top priority** |
| P3 typed-cell band lookup | ✔ (DB) | ✔ | ✔ | ✔ | **Shared, small extension** |
| P4 seed derived→mutable | ✔ (SAN/Luck) | ✔ (HP) | ✔ | ✔ | **Shared** |
| P5 resource + threshold-triggered flags | ★ core (Sanity) | ✔ (HP/death) | ✔ (dying/wounded) | ★ (stress) | **Shared — high value** |
| P6 roll-modifier (adv/bonus die) | ✔ | ★ core | ✔ | ✔ | **Shared** |
| P7 gated dice / reroll | ✔ (0/1d6, push) | ~ | ~ | ✔ (reactions) | Shared-ish, lower prio |
| P8 growth/reset phase | ✔ (improvement) | ✔ (rest) | ✔ | ✔ | **Shared** |

**The single most important takeaway:** CoC proves the grammar's scalar-only engine is the right *foundation* (every derived stat — HP, MP, SAN-start, MOV, Dodge, the S/2 and S/5 band bounds, DB-table key, max-SAN cap — is already expressible as formulas/lookups), but that the **resolution layer** (roll-target + success-bands + resource-thresholds) is entirely missing and is where CoC, PF2e, and Daggerheart all converge. Build P1+P2+P5 as one shared resolution/resource subsystem rather than four per-system ones.

---

### Sources
- [CoC RPG Wiki — Secondary Attributes (HP/MP/MOV/DB/Build)](https://cthulhuwiki.chaosium.com/investigators/step-two-secondary-attributes.html)
- [Roll20 Compendium — Step Two: Generate Characteristics](https://roll20.net/compendium/coc/Step%20Two%20(Generate%20Characteristics))
- [RPG Stack — Damage Bonus (CoC 7e)](https://www.rpgstack.com/glossary/coc7e-field-fields-derived-damage-bonus)
- [RPG Stack — Move Rate (CoC 7e)](https://www.rpgstack.com/glossary/coc7e-field-fields-derived-move-rate)
- [Let's Study CoC 7e — Skill Rolls (success levels/fumble)](https://philgamer.wordpress.com/2018/02/13/lets-study-call-of-cthulhu-7th-edition-part-2a-skill-rolls/)
