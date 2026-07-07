# Grammar-Completeness Research (System-Plugin Substrat)

Research-Artefakte zur Frage: **Ist unsere system-agnostische Plugin-Grammatik reich genug, um reale RPG-Systeme auszudrücken — oder bauen wir versehentlich eine D&D-only-Grammatik?** Erstellt 2026-07-07 durch parallele Deep-Research-Sub-Agents im Rahmen der M6↔M9-Konsolidierung (#225). Jede Datei = ein System = ein Report, einzeln zitierbar.

| Report | System | Belastet primär |
|---|---|---|
| [grammar-gaps-dnd5e.md](grammar-gaps-dnd5e.md) | D&D 5.1 SRD | Rest/Reset, Advantage, Array-Aggregation, Multiclass |
| [grammar-gaps-pathfinder2e.md](grammar-gaps-pathfinder2e.md) | Pathfinder 2e | 4-Grade-Erfolg, wertbehaftete Conditions, Proficiency-Ränge, Resource-Caps |
| [grammar-gaps-daggerheart.md](grammar-gaps-daggerheart.md) | Daggerheart (+CoC-Kurzpass) | Hope/Fear-Dualität, Damage-Threshold-Tracks, Metacurrency-Ökonomie |
| [grammar-gaps-call-of-cthulhu.md](grammar-gaps-call-of-cthulhu.md) | Call of Cthulhu 7e | d100 roll-under, Erfolgsbänder (S/2, S/5), Sanity-Kaskaden |

## Konvergentes Kernergebnis

Der **skalare Formel-Layer** (base/session-state/derived · `formula`+`lookup`+Conditionals+2D-Lookup) ist die **richtige Grundlage** — jeder statische Rechenwert aller vier Systeme (Ability-Mods, HP=(CON+SIZ)/10, PF2e-Modifier-Assembly, CoC-Erfolgsbänder-Grenzen, Damage-Bonus-Tabellen-Key) ist damit ausdrückbar.

Was **allen vier Systemen gemeinsam fehlt**, ist ein zweiter Layer — eine **Resolution-/Resource-Schicht**, die *nicht* in die skalare Engine gehört:

| Geteiltes Primitiv | D&D | PF2e | Daggerheart | CoC |
|---|---|---|---|---|
| **P1 roll-target (under/over)** | ✔ | ✔ | ✔ | ★ |
| **P2 success-bands / degrees-of-success** | ~ | ★ | ★ | ★ |
| P3 typed-cell lookup (dice-Zellen) | ✔ | ✔ | ✔ | ✔ |
| P4 seed derived→mutable (current-vs-max) | ✔ | ✔ | ✔ | ✔ |
| **P5 resource + threshold-triggered flags** | ✔ | ✔ | ★ | ★ |
| P6 roll-modifier (advantage/bonus-die) | ★ | ✔ | ✔ | ✔ |
| P7 gated dice / reroll | ~ | ~ | ✔ | ✔ |
| P8 growth/reset-phase (rest, improvement) | ✔ | ✔ | ✔ | ✔ |
| Array-Aggregation (`sum`/`count` über `ref[]`) | ✔ | ★ | ✔ | ~ |

★ = Kern des Systems · ✔ = gebraucht · ~ = optional/flavor

**Leitentscheidung, die daraus folgt:** Diese Primitive **einmal geteilt** bauen (eine Resolution-/Resource-Schicht), nicht vier Mal pro System. **P1 + P2 + P5** sind die höchste Priorität — sie sind bei ≥3 Systemen Kern-Mechanik. Der bisherige M9-S07..S10-Plan deckt nur den *statischen* Layer; er ist notwendig, aber nicht hinreichend für einen am Tisch spielbaren Bogen irgendeines dieser Systeme.
