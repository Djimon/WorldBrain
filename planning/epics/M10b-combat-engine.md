# EPIC (Sub): Combat Engine

**Status: `needs-design` — Ausgangspunkt gesetzt (Grill-Session 2026-08), aber NOCH nicht voll durchspecct.**
Aus M10 (Multiplayer) herausgelöst als eigenes Subsystem (M10-Decision D22). Der **Kampflog-Reiter** in M10 (D13) ist die Multiplayer-Sicht auf diese Engine.

## Warum eigenes Sub-Epic

Runden, Initiative, Aktions-Auflösung, HP/Status-Tracking sind ein eigenständiges Subsystem, das M10 grob verdoppeln würde. Es hängt am **System-Plugin-Substrat (M9, `condition-engine.ts`/Formel-Layer)** für die Regeln.

## Gesetzte Ausgangspunkte (Grill Q20–Q25 — vorläufig, vor Voll-Grilling)

- **Baseline plugin-frei:** HP-Tracking, **Schaden/Heilen**, Würfe (D17), Initiative, Runden funktionieren **ohne** Regel-Plugin. Das System-Plugin **reichert an** (Formeln, Aktions-Definitionen, Stats). Ohne Plugin → manuell/erzählerisch, DM verteilt Werte von Hand.
- **Initiative:** Plugin-Formel-Wurf falls vorhanden, sonst **manuelle DM-Drag-Reihenfolge**. Standard **Zug-Zeiger + Rundenzähler**, DM-gesteuert.
- **Kämpfer:** Spieler-Charaktere + **DM-hinzugefügte NPCs** — als **vorbereitete Statblocks** oder rein **manuell/erzählerisch**. Verknüpft mit Map-Tokens, wo vorhanden.
- **Auflösung:** **automatisch, vertrauensbasiert** — Spieler setzen eigenen Schaden/Status selbst, **kein DM-Bestätigen**; der DM kann jederzeit **nachsehen/prüfen**. Ergebnis mit Wurf-Sichtbarkeit (D17) im Kampflog.
- **Kampfzustand:** HP/Ressourcen/Zustände pro Kämpfer, live-synced. **Mini-Übersicht:** Liste aller Charakter-Avatare mit aktueller HP + **Glow, wenn dran**.
- **Position/Bewegung:** **rein visuell** (Token auf Map, frei bewegbar), **kein erzwungenes Grid/Reichweite** — Absprache/DM adjudiziert. Grid/Range später.

## ❓ Offen — braucht eigene Grill-Runde (needs-design)

- Statblock-Format (Plugin) fürs Kampf-Roster; Ressourcen-/Zustands-Definition.
- **Öffentlicher vs. privater Kampfzustand:** was sehen andere Spieler von fremder HP/Status (voll? „angeschlagen"? nichts?).
- Aktions-Katalog & Auflösungs-Pipeline im Detail (was trägt eine Aktion, wie greift die Plugin-Formel).
- Wie das Subsystem in Stories zerfällt.
- Genaue Kopplung an M9-Substrat (roll-target/success-bands/resource-thresholds — siehe `planning/research/`).

## Abhängigkeiten
- **M9 System-Plugin-Substrat** (Regeln/Formeln) — harte Voraussetzung für plugin-getriebenen Kampf.
- **M10** (Multiplayer) — liefert Kampflog-Sicht (D13), Würfel (D17), Token (D18), Live-Transport (D20).
