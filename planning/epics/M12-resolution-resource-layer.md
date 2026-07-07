# EPIC-018: Resolution & Resource Layer

## Goal

Ein **system-agnostischer zweiter Layer** über der skalaren Feld-Engine. Die Feld-Engine (M9-S07..S10)
berechnet deterministische Werte aus den *eigenen Feldern* einer Entity (`formula`, `lookup`,
Conditionals, 2D-Lookup). Sie ist die richtige Grundlage — aber nur die *halbe* Grammatik. Was allen
untersuchten Systemen (D&D 5e, Pathfinder 2e, Daggerheart, Call of Cthulhu) **gemeinsam** fehlt, ist die
Schicht, die deklariert:

1. **wie** ein Wert durch einen Wurf *getestet* wird (roll-under / roll-over),
2. **welche Ergebnis-Bänder** ein Wurf erzeugt (Erfolgsgrade / Erfolgsstufen),
3. **Ressourcen**, die sich im Spiel verändern — mit Cap, Schwellen-Effekten und Reset,
4. **Wurf-Modifikatoren** (Advantage/Disadvantage, Bonus/Penalty-Würfel),
5. **Zustands-Übergänge** (Rest-Reset, Auto-Dekrement, Improvement-Phasen).

Alles **deklarativ und plugin-definiert** — kein System-spezifischer Sonderweg, kein Skript. Die Engine
**würfelt weiterhin nicht selbst**: sie klassifiziert einen *gelieferten* Wurf in ein Band und leitet
Ergebnis→Effekt-Hooks weiter. Determinismus bleibt: zu gegebenem Wurf-Input sind die Outputs eindeutig.

Grundlage: die vier Reports unter `planning/research/` (Konvergenz-Matrix im README). Diese Schicht ist
Teil des **systemagnostischen Frameworks** (M6-Linie, „wie werden Regeln definiert") und wird von
konkreten System-Plugins (M9, z.B. `dnd5e_srd`) *konsumiert*.

## Decisions

1. **Zwei-Layer-Trennung.** Skalare Feld-Engine (M9, unverändert, rein/deterministisch) **+** deklarativer Resolution-/Resource-Layer (dieses Epic). Der Resolution-Layer darf abgeleitete Skalare als **Inputs** lesen (Band-Grenzen, Ressourcen-Caps sind Formeln), lebt aber **nicht** in der Formel-Engine.
2. **Die Engine würfelt nicht.** Würfel bleiben extern (M8-S11 Dice-Link). Dieser Layer klassifiziert ein *geliefertes* Wurf-Ergebnis in Bänder und routet Ergebnis→Effekt-Hooks. Kein RNG im Kern.
3. **Systemagnostisch by construction.** Jedes Primitiv wird gegen **≥2** der vier Systeme validiert — keine D&D-spezifische Form. `roll-under` (CoC) und `roll-over` (D&D/PF2e) sind eine Konfiguration desselben Primitivs; N Bänder verallgemeinern PF2e-4-Grade / CoC-5-Stufen / Daggerheart-Hope-Fear.
4. **Geteilt bauen, nicht pro System.** P1 (roll-target), P2 (success-bands), P5 (resource+threshold) sind die tragenden geteilten Primitive — je *ein* datengetriebenes Primitiv, nicht vier.
5. **Ein Ressourcen-Primitiv vereint viele Dinge:** HP, Spell-Slots, Sanity, Hope, Stress, Luck, Ki, Rage-Uses, Focus, Hero Points, Schild-HP sind Instanzen *einer* `resource` (seed, Cap-Formel, min, Schwellen-Flags, Reset-Trigger).
6. **Ergebnis→Effekt-Hooks sind deklarativ und begrenzt.** Ein Band/Outcome darf `gain`/`spend`/`set` auf Ressourcen oder Flags auslösen — **kein** beliebiger Code. Das ist der „Event-Layer", aber datengetrieben.
7. **Cross-Character-Resolution** (Opposed Rolls, Assist, Rally-Transfer) ist anerkannt, aber V1 vergleicht nur **zwei gelieferte Ergebnisse**. Live-Verdrahtung über das Netz koppelt an M10 (dort Transport, hier nur die Regel).
8. **Manual-first, Automation optional.** Konsistent mit M9-Decision 15: der Layer *ermöglicht* Automation, aber ein Plugin/Tabelle darf manuell bleiben (Conditions/Exhaustion-Effekte dürfen V1 Prosa + manueller Toggle sein).
9. **Typisierter Schaden / Weakness-Resistance** wird V1 als **deklarierte Daten** am Bogen gezeigt (GM wendet an). Der eigentliche Damage-Instance-Resolver (×½/×2/×0 auf ein typisiertes Schadenspaket) braucht einen Nicht-Skalar-Eval-Kontext und ist **zurückgestellt** (eigene spätere Story, siehe Out of Scope).
10. **Determinismus & Testbarkeit.** Jedes Primitiv ist als reine Funktion `(felder, geliefertes_wurf_ergebnis) → outcome/effekt` testbar; keine `eval()`-Nutzung; Fehler (fehlendes Feld, kaputte Bandkonfig) → `—` statt Crash.
11. **Eine geteilte Deskriptor-Grammatik.** Die 10 Primitive sind stark gekoppelt (S02 baut auf S01, S03 speist S07, S06 erweitert S03/S07) und teilen sich *ein* Deskriptor-Schema. **M12-S01 legt diese geteilte Grammatik normativ fest** (Feld-Referenzen, Ausdruck-Kontext mit `roll`-Variable, Outcome-/Effekt-Verben, Fehler-Semantik); S02–S10 konform dazu, erfinden keine Parallel-Formen. Das ist der Riegel gegen Schema-Drift — nicht mehr Epic-Detail, sondern eine bewusst gebündelte Design-Verantwortung in der ersten Story.

## Out of Scope

- Die Engine würfelt selbst / eingebauter RNG (bleibt extern, M8-S11).
- Vollständige Kampf-Automation, Initiative-Reihenfolge-Engine, Turn-Tracker.
- Damage-Instance-Resolver (typisierter Schaden ×½/×2/×0 mit Ausnahme-Klauseln) — V1 nur deklarierte Daten; Resolver ist Folge-Story.
- Netz-/Live-Sync von Cross-Character-Resolution (das ist M10-Transport; hier nur das Regelmodell).
- Beliebiges Scripting in Plugins (nur deklarativ).
- Automatische Anwendung *aller* Condition-Effekte über deklarierte Modifikatoren hinaus (Prosa + manuell ist V1 zulässig).
- Multiclass-Datenmodell & Array-Aggregation (`sum`/`count` über `ref[]`) — gehören zur M9-Grammatik-Erweiterung, nicht in diese Resolution-Schicht (dort verankern).

## Stories

### M12-S01: Roll-Target & Roll-Richtung (P1)

**Ziel:** Ein Feld kann als *Wurf-Ziel* deklariert werden — die Zahl, gegen die ein Würfel verglichen wird — mit Richtung. Fundament für alle Bänder. Deckt CoC (roll-under vs. Skill) und D&D/PF2e (roll-over vs. DC) mit *einem* Primitiv ab. **Diese Story legt zugleich die geteilte Deskriptor-Grammatik fest (Decision 11), an die S02–S10 sich halten.**

**AC:**
- **Geteilte Grammatik-Grundlagen (normativ für alle M12-Stories):** einheitliche Feld-Referenz-Syntax, ein Ausdruck-Auswertungs-Kontext mit der Variable `roll` (das gelieferte Wurf-Ergebnis) zusätzlich zu Entity-Feldern, ein einheitliches Fehler-Verhalten (`—`), und die aufgezählte Menge der Outcome-/Effekt-Verben (definiert final in S07, hier als Erweiterungspunkt reserviert).
- Deskriptor `"roll": { "target": <fieldRef|formula>, "direction": "under" | "over" | "meet", "die": "1d100" | "1d20" | ... }`.
- Der `target` darf ein abgeleiteter Skalar (Formel/Lookup) sein — z.B. CoC-Skillwert, D&D `dc = 8 + prof + mod`.
- Der Layer klassifiziert ein **geliefertes** Wurf-Ergebnis als `success`/`failure` gemäß Richtung (`under`: roll ≤ target; `over`: roll ≥ target; `meet`: roll ≥ target).
- Rendering: das Wurf-Ziel wird am Bogen angezeigt (z.B. „Dodge 40", „DC 15").
- Kein RNG: der Layer erzeugt keinen Wurf, er nimmt einen entgegen (Decision 2).
- Fehlerfall (Target nicht auflösbar) → `—`, kein Crash.
- Unit-Tests (`m12-s01-`): roll-under (CoC-Skill 40: 40→success, 41→failure), roll-over (DC 15: 15→success, 14→failure).
- `database` prop typed as `DatabaseLike`; keine `unknown`/`as never` Casts; keine `eval()`.

---

### M12-S02: Success-Bands / Degrees of Success (P2) — *höchste Priorität*

**Ziel:** Ein Wurf-Ziel liefert nicht nur pass/fail, sondern eines von N **benannten Ergebnis-Bändern**, definiert als geordnete Formel-Schwellen. Deckt PF2e (4 Grade via ±10), CoC (5 Stufen via `S`, `S/2`, `S/5`) und Daggerheart-Grundlage ab.

**AC:**
- Deskriptor `"bands": [ { "name": "extreme", "when": "<expr über roll & target>" }, ... ]` — geordnet, erstes zutreffendes Band gewinnt.
- Band-Grenzen sind **Formeln** der bestehenden Engine: z.B. CoC `roll <= floor(target/5)`, PF2e `roll >= dc + 10`.
- Der `roll` ist als Variable in den Band-Ausdrücken verfügbar (der gelieferte Wurf).
- **Step-Shift:** optionaler `"shift"`-Input (nat 20 → +1 Band, nat 1 → −1 Band), nach der numerischen Klassifikation angewandt und an den Enden geklemmt (PF2e; D&D nat-crit).
- Output ist ein **Band-Label** (kein Skalar) — ein neuer Ergebnis-Typ neben Skalar.
- Konfigurierbar für roll-under *und* roll-over (baut auf M12-S01).
- Fehlerfall (keine Band trifft / kaputte Config) → definiertes Default-Band bzw. `—`.
- Unit-Tests (`m12-s02-`): CoC Skill 50 → 10=extreme, 25=hard, 50=regular, 51=fail, 100=fumble; PF2e DC 20 → 30=crit-success, 20=success, 11=failure, 10=crit-failure; nat-1/nat-20 Shift.
- Keine `eval()`; `database` prop `DatabaseLike`.

---

### M12-S03: Resource-Primitiv (Cap, Seed, Schwellen-Flags) (P5 + P4) — *höchste Priorität*

**Ziel:** Ein `resource`-Typ, der viele bisher un-modellierbare Dinge vereint (HP, Sanity, Hope, Stress, Luck, Slots, Ki). Session-state-Wert mit abgeleitetem Cap, Seed aus einem abgeleiteten Wert, und Schwellen-Regeln, die benannte Zustände/Flags setzen.

**AC:**
- Deskriptor:
  ```
  "resource": {
    "seedFrom": <formula/field>,          // Init bei Erstellung, danach mutierbar
    "max": <formula>,                       // z.B. CoC 99 - mythos; darf Feld referenzieren
    "min": 0,
    "triggers": [
      { "when": "value == 0", "set_flag": "permanentMadness" },
      { "when": "delta_single <= -5", "set_flag": "temporaryInsanity" },
      { "when": "delta_session <= -(0.2 * session_start)", "set_flag": "indefiniteInsanity" }
    ]
  }
  ```
- **Seed (P4):** `seedFrom` initialisiert einen session-state-Wert aus einem abgeleiteten Wert bei Charaktererstellung; danach divergiert er (D&D `current_hp` seed von `max_hp`; CoC `sanity` seed von `POW`).
- **Cap-Erzwingung:** `max` (Formel) klemmt den mutierbaren Wert; sinkt `max` (z.B. Mythos steigt), wird `current` nachgezogen.
- **Schwellen-Trigger** auf `value`, `delta_single` (letzte Einzeländerung), `delta_session` (kumuliert über Session); Vergleichsziel darf Formel sein (`current/5`).
- Trigger setzen **benannte Flags/Zustände**, die der Bogen anzeigt/trackt (keine Regel-Prosa nötig, aber optional verlinkbar).
- Engine trackt `delta_single`, `delta_session`, `session_start` pro Ressource, session-scoped (koppelt M8-S01 #152).
- Deckt als einfache Spezialfälle: Hope/Stress/Luck (nur Cap), Slots (Cap + Reset via S04), Sanity (alle Trigger).
- Unit-Tests (`m12-s03-`): Sanity seed=POW, max=99−mythos, −5-Einzelverlust → temporaryInsanity, kumuliert ≥1/5 → indefinite, 0 → permanent; HP seed von max, Cap-Klemmung.
- `database` prop `DatabaseLike`; session-scoped Persistenz; keine `eval()`.

---

### M12-S04: Reset- & Zustands-Übergangs-Phasen (P8)

**Ziel:** Deklarative Regeln, die session-state/Ressourcen bei benannten Ereignissen zurücksetzen oder verändern. Schließt die früher gefundene Rest-Reset-Lücke und deckt PF2e-Auto-Dekrement + CoC-Improvement mit ab.

**AC:**
- Deskriptor pro session-state-Feld/Ressource: `"transitions": [ { "on": "short_rest"|"long_rest"|"session_start"|"turn_end"|"downtime", "action": "reset"|"refill_to_max"|"refill_to(<formula>)"|"decrement"|"set(<formula>)"|"apply_dice(<dice>, condition)" } ]`.
- Eine Core-Aktion pro Trigger (z.B. „Long Rest") führt **alle** passenden Transitions atomar aus.
- Deckt: D&D Long Rest (Slots→0-used, Hit Dice, Exhaustion −1), Warlock-Slots auf Short Rest, PF2e Frightened −1 auf `turn_end`, Focus-Refill, Hero-Points auf `session_start`, CoC Skill-Improvement-Phase auf `downtime` (`apply_dice(1d10, roll > skill)`).
- Reihenfolge/Idempotenz definiert; ein Trigger mehrfach auslösbar ohne Doppel-Effekt jenseits der Definition.
- Unit-Tests (`m12-s04-`): Long-Rest setzt `spell_slots_used_*`→0 und Exhaustion −1; `turn_end` dekrementiert frightened; downtime-Improvement wendet 1d10 nur bei erfülltem Condition an.
- `database` prop `DatabaseLike`; keine `eval()`; keine `prompt()/alert()/confirm()`.

---

### M12-S05: Wurf-Modifikatoren — Advantage/Disadvantage & Bonus/Penalty (P6)

**Ziel:** Ein einziges Wurf-Modifikator-Primitiv für Advantage/Disadvantage (D&D), Bonus/Penalty-Würfel (CoC) und verwandte keep-best/worst-Mechaniken. An ein Wurf-Ziel (M12-S01) angeheftet.

**AC:**
- Deskriptor `"roll_modifier": { "kind": "keep" | "extra-die", "of": <n>, "pool": "full"|"tens", "keep": "best"|"worst", "stacking": "cancel-pairwise"|"none" }`.
- `keep of:2 keep:best` = D&D Advantage; `extra-die pool:tens keep:best` = CoC Bonus-Würfel.
- **Pairwise cancel:** ein Advantage + ein Disadvantage heben sich auf (D&D); mehrere Bonus/Penalty-Würfel netto verrechnet (CoC).
- Passive ±: optionaler flacher Term für passive Werte (D&D Passive ±5 bei adv/disadv).
- Der Layer beschreibt/klassifiziert; das tatsächliche Ziehen bleibt extern (M8-S11) — der Layer sagt „roll 2, keep highest".
- Unit-Tests (`m12-s05-`): adv+disadv → normal; zwei Penalty + ein Bonus → netto ein Penalty.
- `database` prop `DatabaseLike`.

---

### M12-S06: Typisierte Tabellen-Zellen & parametrisierter Lookup (P3 + Damage-Threshold-Band)

**Ziel:** Zwei kleine, zusammengehörige Erweiterungen des bestehenden `lookup` (M9-S07/S10): Tabellen-Zellen dürfen einen **Würfelausdruck** zurückgeben, und ein Lookup-Key darf ein **externer Parameter** (eingehender Schaden) statt nur eines eigenen Feldes sein.

**AC:**
- **Typisierte Zellen:** `tables/*.json`-Zellen dürfen `{ "type": "scalar"|"dice", "value": ... }` sein; ein Lookup-Feld deklariert `"returns": "dice"`. Deckt CoC Damage Bonus (`+1d4`/`+2d6`), D&D Cantrip-Scaling.
- **Parametrisierter Key:** ein Lookup darf gegen einen *übergebenen* Wert (z.B. `incoming_damage`) klassifizieren statt gegen ein Charakterfeld; Schwellen bleiben Formeln (`armor_minor + level`). Deckt Daggerheart Damage-Thresholds (Betrag → 1/2/3 Marks) und CoC Major-Wound (`≥ maxHP/2`).
- Optionaler Pre-Band-**Reducer** (Daggerheart Armor-Slot verschiebt den Input um ein Band nach unten) — als Hook (koppelt S03-Ressource/S07-Hooks).
- 1D/2D-Rückwärtskompatibilität bleibt (M9-S07/S10 unverändert nutzbar).
- Unit-Tests (`m12-s06-`): CoC DB-Tabelle (STR+SIZ 130→+1d4), Daggerheart Damage-Band (Betrag zwischen Major und Severe → 2 Marks).
- `database` prop `DatabaseLike`.

---

### M12-S07: Ergebnis→Effekt-Hooks & gated Dice (P6-Event + P7)

**Ziel:** Deklarative, begrenzte Hooks, die aus einem Band/Outcome heraus Ressourcen/Flags verändern — der „Event-Layer", datengetrieben. Plus outcome-bedingte Würfel-Payloads (CoC `0/1d6`).

**AC:**
- Hook-Deskriptor an Bändern/Outcomes: `"on": { "<band>": [ { "gain"|"spend"|"set": <resourceRef>, "amount": <formula|dice> }, { "set_flag": <name> } ] }`.
- Beispiele: Daggerheart „with Hope" → `gain(hope, 1)`; Crit → `gain(hope,1); clear(stress,1)`; CoC gescheiterter SAN-Wurf → `spend(sanity, roll(1d6))`.
- **Gated Dice:** `"onSuccess"/"onFailure": <expr|dice>` — Payload abhängig vom Outcome (SAN „0/1d6").
- **Reroll-Deskriptor:** `"reroll": { "allowedOnce": true, "condition": <expr>, "consequence": <effect> }` (CoC Pushing) — V1 markiert die Möglichkeit + Konsequenz, erzwingt keine Automation.
- **Kein beliebiger Code** — nur die aufgezählten Effekt-Verben (gain/spend/set/set_flag/clear) auf deklarierte Ressourcen/Flags (Decision 6).
- Effekte fließen über das Ressourcen-Primitiv (S03) → deren Trigger feuern normal (Kaskade: SAN-Verlust via Hook → Schwellen-Flag).
- Unit-Tests (`m12-s07-`): Hope-Gain bei „with Hope"; SAN-`spend(1d6)` bei Fail löst temporaryInsanity-Trigger aus.
- `database` prop `DatabaseLike`; keine `eval()`.

---

### M12-S08: Track-Felder (markierte Slot-Arrays)

**Ziel:** Ein `track`-Feld für begrenzte markierte/unmarkierte Slot-Arrays — anders als ein Countdown-Integer. Deckt Daggerheart HP/Stress/Armor-Slots und D&D Death-Save-Boxen.

**AC:**
- Deskriptor `"track": { "slots": <formula>, "on_full": <effect>, "on_last_mark": <effect>, "reset_on": <transition> }`.
- `slots` (Anzahl) ist eine Formel (Daggerheart HP-Slots wachsen mit Level/Tier).
- Operationen `mark(n)` / `clear(n)`, session-state; „voll → Konsequenz", „letzte Markierung → death move".
- `reset_on` nutzt S04-Transitions (Rest/Session/Downtime).
- Death Saves als 3+3-Track mit Erfolg/Fehlschlag-Achsen darstellbar.
- Unit-Tests (`m12-s08-`): Daggerheart HP-Track slots=6, letzte Mark → on_last_mark-Flag; Death-Save-Track 3 Fehlschläge → Flag.
- `database` prop `DatabaseLike`.

---

### M12-S09: Cross-Character-Resolution (Opposed / Assist) — *scoped*

**Ziel:** Vergleich der Ergebnisse **zweier** Charaktere (Opposed Rolls, Assist, Rally-Transfer) — auf Regel-Ebene, ohne Netz-Verdrahtung.

**AC:**
- Ein Resolution-Deskriptor darf zwei gelieferte Band-Ergebnisse vergleichen: höheres Band gewinnt, Tie-Break per Ziel-Wert (CoC Opposed).
- Transfer-Hook: eine Ressource eines Charakters kann per Effekt auf einen anderen wirken (Daggerheart Rally/Tag-team) — nur die Regel, Persistenz session-scoped.
- **Abgrenzung:** *keine* Netzwerk-/Live-Sync (das ist M10). V1 nimmt zwei Ergebnisse entgegen und vergleicht.
- Unit-Tests (`m12-s09-`): Opposed (Angreifer extreme vs. Verteidiger hard → Angreifer gewinnt); Tie-Break per Skill.
- `database` prop `DatabaseLike`. **Priorität niedriger** — kann als letzte Story laufen oder in ein Folge-Epic, falls M10 noch nicht steht.

---

### M12-S10: Konformanz-Nachweis (2 Systeme)

**Ziel:** Beweisen, dass der Layer **nicht D&D-only** ist. Der Layer wird an zwei strukturell verschiedenen Systemen ausgeübt.

**AC:**
- **`dnd5e_srd` erweitern** (aus #225/#169): Advantage/Disadvantage auf einem d20-Angriff (S05), Long/Short-Rest-Reset der Slots (S04), Death Saves als Track (S08), HP als Ressource mit Seed (S03).
- **Toy-Fixture `roll_under_demo`** (systemagnostisch, klein): ein CoC-artiges roll-under-System mit Skill-Ziel (S01), 5-Stufen-Bändern (S02), einer Sanity-artigen Ressource mit Kaskaden-Trigger (S03) und Bonus/Penalty-Würfel (S05). Beweist roll-under + Erfolgsstufen + Ressourcen-Schwellen ohne D&D-Annahmen.
- Beide laden fehlerfrei durch den Validator; die deklarierten Resolutions/Ressourcen werden korrekt klassifiziert/getrackt.
- Unit-Tests (`m12-s10-`): je ein End-to-End-Durchlauf pro Fixture.
- Kein proprietärer Inhalt; nur SRD/Toy.

---

## Story Tracking

| Story | Prio | Kern-Systeme | Titel | Issue |
|---|---|---|---|---|
| M12-S01 | p0 | CoC, D&D, PF2e | Roll-Target & Roll-Richtung | #226 |
| M12-S02 | p0 | PF2e, CoC, DH | Success-Bands / Degrees of Success | #227 |
| M12-S03 | p0 | CoC, DH, D&D | Resource-Primitiv (Cap, Seed, Schwellen) | #228 |
| M12-S04 | p1 | D&D, PF2e, CoC | Reset- & Zustands-Übergangs-Phasen | #229 |
| M12-S05 | p1 | D&D, CoC | Wurf-Modifikatoren (Advantage/Bonus-Würfel) | #230 |
| M12-S06 | p1 | CoC, DH, D&D | Typisierte Tabellen-Zellen & param. Lookup | #231 |
| M12-S07 | p1 | DH, CoC | Ergebnis→Effekt-Hooks & gated Dice | #232 |
| M12-S08 | p2 | DH, D&D | Track-Felder (markierte Slot-Arrays) | #233 |
| M12-S09 | p2 | CoC, DH | Cross-Character-Resolution (Opposed/Assist) | #234 |
| M12-S10 | p1 | D&D + Toy | Konformanz-Nachweis (2 Systeme) | #235 |

**Reihenfolge:** S01 → S02 → S03 bilden die tragende Achse (P1/P2/P5). S04–S07 bauen darauf. S08/S09 ergänzen; S10 ist der Abnahme-Nachweis (nach S01–S05 sinnvoll durchführbar).

## Abhängigkeiten

- **M9-S07..S10** (skalare Feld-Engine: `formula`, `lookup`, Conditionals, 2D-Lookup) — dieser Layer liest deren abgeleitete Skalare als Inputs.
- **M8-S01** (#152 Session-Schema) — Ressourcen/Track/Deltas sind session-scoped.
- **M8-S11** (Dice-Link) — liefert die externen Würfe, die dieser Layer klassifiziert; S05/S06/S07 koppeln daran.
- **M10** (Multiplayer-Transport) — nur für M12-S09 (Cross-Character live); das Regelmodell hier ist unabhängig.
- **#225-Konsolidierung** — dieser Layer ist Teil des einen systemagnostischen Frameworks; das eine `dnd5e_srd`-Plugin (M9-Deliverable) ist der primäre Konsument (M12-S10).

## Rückwirkung auf #169 (M9-S06)

Der Anspruch „spielbar-vollständiger 5e-Bogen" hängt an diesem Layer: **Rest-Reset (S04)**, **Advantage (S05)** und **HP/Slots als Ressource (S03)** sind Voraussetzung. #169 ist damit zusätzlich zu M9-S07..S10 durch **M12-S01..S05** blockiert. Multiclass & Array-Aggregation bleiben separat in der M9-Grammatik-Erweiterung.
