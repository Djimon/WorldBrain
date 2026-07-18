# EPIC-022: World-State & Event-Folgen (γ, derived)

**Milestone:** M14 — Calendar, Events & World State. **Kopplung:** EPIC-021 (β, Events tragen `effects`), M12 (Resolution/Resource-Layer, geteilte Effekt-Vokabel), M5 (time-events-world-state-light).

## Goal

Events tragen **Folgen** (`effects`), die den **World-State** verändern: NPCs/Monster töten/entstehen lassen, benannte Variablen setzen, Schalter/Flags steuern. Der World-State ist **derived**: der Zustand an einem Counter-Tag D ist die Faltung aller Effekt-Assertions mit `day ≤ D` (last-wins pro Target). Kein „Feuern", kein mutierender Zustand — der DM springt frei in der Zeit, der Zustand projiziert sich immer korrekt (konsistent mit Kalender-als-Projektion). Die Effekt-Vokabel ist **dieselbe wie M12-S07** (Charakterbogen-Effekte), nur mit generalisiertem Target.

## Decisions (verbatim in jede betroffene Story-AC)

1. **Derived/Projektion, nicht imperativ.** World-State an Tag D = Faltung aller Effekt-Assertions mit `day ≤ D`, **last-wins pro Target**. Kein mutierender Zustand, kein zeitpunkt-abhängiges „Feuern". Zeitreise (Vergangenheit/Zukunft) ergibt sich gratis.
2. **Effekt = Einzeltag-Assertion.** Jeder Effekt trägt einen eigenen `day` (Counter-Integer, default = `event.start_day`), ein `target`, ein `verb`, einen `value`. Ein Event (auch eine `phase`) trägt eine **Liste** solcher Effekte — es gibt KEINEN windowed/latching-Modus auf Event-Ebene. „Belagert@Tag2, vernichtet@Tag4" = zwei Assertions.
3. **Supersede = gleiches Target.** Ein neuer Effekt auf dasselbe Target ersetzt (per last-wins) den vorherigen automatisch. „Belagert → vernichtet" sauber als **ein** Target (Enum-Wert) modelliert; alternativ zwei Flags + expliziter Aus-Assertion.
4. **Geteilte Effekt-Vokabel mit M12-S07.** Verben `set` / `gain` / `spend` / `set_flag` / `clear` (aus M12-S07). Kein zweites Vokabular. **M14-S08 ist die normative Fundament-Story** — sie pinnt Verben + Target-Modell; alle anderen (γ **und** M12-S07 #232) konform dazu (Anti-Drift, analog M12-S01).
   > **Ist-Zustand 2026-07 (Reviewer-Finding C2 — ehrlich):** Die Anti-Drift-Garantie war bis #263+#269 landen nur **nominal**. `effect-vocabulary.ts` ist vorgebaut (richtiges scope-aware `ParsedTarget`), aber `hook-engine.ts` (M12-S07, closed) trug zunächst weiter sein flaches `resource:string`-Target. Verben stimmten bereits überein; die Divergenz war **allein das Target-Modell**. Reihenfolge zur Auflösung: **#263 → #269 → #264–#268**.
   > **Update 2026-07-18 (Drift-Korrektur, Commit 1ae7ef9):** #269 ist gelandet. `hook-engine.ts` importiert `parseTarget` als `parseSharedTarget` + `EffectVerb` aus `effect-vocabulary.ts`; `resolveHookTarget` delegiert `world:`/`entity:` an den gemeinsamen S08-Parser; Verben sind über das shared `EffectVerb` typisiert. Der **Target-Merge ist FERTIG, nicht mehr „nur nominal"**. `char:`/`session:` sind die S08-reservierten Präfixe.
5. **Target ist scope-aware.** Adressierung mit Scope-Präfix: `world:<var>`, `entity:<entityId>#status`. Für später vorgesehen (Design erweiterbar, nicht bauen): `session:<var>`, `char:<charId>:<resource>`. **V1 nur `world:` + `entity:…#status`.** Session erbt/erweitert World-Flags (späterer Ausbau).
6. **World-Variablen ad-hoc** (create-on-use, **kein** Registry). Erster `set`/`set_flag` auf `world:foo` erzeugt die Variable implizit.
7. **Entity-Status als Assertion-Timeline.** `entity:<id>#status` erhält Status-Assertions (`alive`/`dead`/`present`/`absent`/frei); der Status einer Entity an Tag D ist die letzte Assertion ≤ D. Frei erweiterbare Status-Werte (kein festes Enum in V1, nur Empfehlungsliste).
8. **Konsum V1 minimal:** eine derived Query `worldStateAt(day)` (Map target→value) und `entityStatusAt(entityId, day)`; ein sichtbarer Konsument (Entity-Status am aktiven Kalender-Tag). Kein Session-Play-Konsum in V1.

## Anti-Patterns (verbatim in AC der betroffenen Stories)

- **AP-001:** database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites.
- **AP-006:** No `try/catch` around DB operations; errors propagate to the caller (Ausnahme: `JSON.parse` von `properties`/DB-Daten → sicherer Fallback).
- **AP-003:** No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API. *(S12 Effekt-Editor)*
- **AP-008 (RTL):** All RTL name/text queries anchored (`^…$`) where labels share a prefix; no bare `|<fragment>` catch-all; `||`/`??` fallbacks use `queryBy*`; multi-match uses `getAllBy*`/`within`. *(S12/S13)*

## Out of Scope

- Imperativer/mutierender World-State, „Firing" beim Überschreiten eines Tages (Decision 1).
- Session-/Charakter-Targets (`session:`/`char:`) — nur Adressierung *vorgesehen*, nicht gebaut (Decision 5).
- Regel-Automation der Effekte im Spiel (nur derived Projektion + Anzeige; keine Kampf-/Resolution-Ausführung — das ist M12).
- World-Variablen-Registry/Typisierung (ad-hoc, Decision 6).

## Stories

### M14-S08: Effekt-Vokabel & Target-Modell (normativ)
**Owner:** data-model (shared). **Ziel:** Die eine normative Definition von Effekt-Verben + scope-aware Target — Grundlage für γ **und** M12-S07.

**AC:**
- Effekt-Form: `{ day: number, target: string, verb: 'set'|'gain'|'spend'|'set_flag'|'clear', value?: unknown }`.
- **Target-Adressierung scope-aware** (Decision 5): V1 gültig `world:<name>` und `entity:<entityId>#status`; Präfixe `session:`/`char:` reserviert (Parser kennt sie, V1 lehnt sie mit klarer Meldung ab).
- Verben identisch zu M12-S07 (Decision 4); eine gemeinsame Typ-/Konstanten-Definition, kein Zweitvokabular.
- Ungültiges Target/Verb → definierter Fehler (kein stilles No-op).
- AP-001 in AC.
- Tests: `m14-s08-effect-vocab` — Parser akzeptiert `world:`/`entity:…#status`, lehnt `session:` in V1 ab; Verb-Set == M12-S07.

### M14-S09: Effekt-Assertions am Event speichern
**Owner:** data-model. **Blocked by:** M14-S04 (β), M14-S08. **Ziel:** `properties.effects` trägt die Assertion-Liste, validiert.

**AC:**
- `properties.effects` = Array von Effekten (S08-Form). Default `day = event.start_day`, überschreibbar pro Effekt.
- Anlegen/Ändern/Löschen einzelner Effekte an einer Event-Entity (über den β-Entity-Service).
- Validierung gegen S08 (Target/Verb); ungültige Effekte werden abgelehnt, nicht gespeichert.
- `JSON.parse`-Fallback beim Lesen (AP-006).
- AP-001, AP-006 in AC.
- Tests: `m14-s09-event-effects-storage` — Effekt mit eigenem `day`; Default-`day`=`start_day`; ungültiges Target abgelehnt.

### M14-S10: Derived World-State-Projektion
**Owner:** data-model/service. **Blocked by:** M14-S08, M14-S09. **Ziel:** Die reine Faltung — Zustand an Tag D.

**AC:**
- `worldStateAt(database, day)` → `Map<target, value>`: sammelt alle Effekt-Assertions aller Events mit `assertion.day ≤ day`, sortiert nach `day`, **last-wins pro Target**.
- `entityStatusAt(database, entityId, day)` → letzter Status ≤ `day` (oder undefiniert).
- Verben angewandt: `set`/`set_flag` überschreiben; `gain`/`spend` kumulieren numerisch; `clear` entfernt das Target. Reihenfolge bei gleichem `day` deterministisch definiert.
- Reine Funktion (gegeben Assertions + day → Zustand), unabhängig testbar; korrekt für **negative** Tage.
- AP-001, AP-006 in AC.
- Tests: `m14-s10-world-state-projection` — belagert@2/vernichtet@4: Zustand@3=belagert, @5=vernichtet; `gain`+`gain` kumuliert; negativer Tag.

### M14-S11: Ad-hoc World-Variablen & Entity-Status-Timeline
**Owner:** data-model. **Blocked by:** M14-S10. **Ziel:** World-Vars ohne Registry; Entity-Status als abgeleitete Timeline.

**AC:**
- Erster `set`/`set_flag` auf `world:<name>` erzeugt die Variable implizit (kein Vorab-Registry, Decision 6).
- `entity:<id>#status`-Assertions bilden die Status-Timeline; `entityStatusAt` liest sie.
- Auflisten aller bisher genutzten World-Variablen (für den Target-Picker in S12) — abgeleitet aus vorhandenen Assertions, nicht aus einem Registry.
- AP-001, AP-006 in AC.
- Tests: `m14-s11-adhoc-vars-entity-status` — unbekannte `world:foo` per `set` nutzbar; Entity-Status wechselt über Tage; genutzte-Vars-Liste korrekt.

### M14-S12: Effekt-Editor im Event-Formular
**Owner:** ui. **Blocked by:** M14-S07 (β-Formular), M14-S09, M14-S11. **Ziel:** Effekte an einem Event pflegen.

**AC:**
- Im Event-Formular: Liste der Effekte; Hinzufügen/Entfernen.
- Pro Effekt: `day` (default `start_day`, Datums-Widget aus α), Target-Auswahl (World-Var per Autofill inkl. genutzter Vars aus S11, oder Entity-Ref für `entity:…#status`), Verb-Auswahl (S08-Set), `value`-Eingabe.
- Ungültige Effekte (S08) werden vor Speichern markiert und blockiert; kein `prompt()/alert()/confirm()` (AP-003).
- Alle nutzer-eingegebenen Strings escaped, falls in Anzeige/Export interpoliert.
- AP-001, AP-003, AP-008(RTL) in AC.
- Tests: `m14-s12-effect-editor` — `.dom.test.tsx`: Effekt hinzufügen schreibt `properties.effects`; ungültiges Target blockiert Speichern.

### M14-S13: Konsum — Entity-Status am Kalender-Tag
**Owner:** ui. **Blocked by:** M14-S10. **Ziel:** Ein sichtbarer derived-Konsument als Proof.

**AC:**
- Für den aktiven Kalender-Tag (bzw. das gezeigte Fenster) zeigt die Entity-Anzeige den derived Status (`entityStatusAt`) — z.B. NPC „tot" ab seinem Todes-Event, „lebendig" davor.
- Rein lesend/projiziert; ändert keine gespeicherten Daten.
- AP-001, AP-008(RTL) in AC.
- Tests: `m14-s13-entity-status-consumer` — vor Todes-Tag lebendig, danach tot; Zeitsprung ändert Anzeige, nicht die DB.

### M14-S14: M12-S07 auf geteiltes Target-Modell angleichen
**Owner:** koordination/data-model. **Blocked by:** M14-S08. **Ziel:** Sicherstellen, dass M12-S07 (#232, noch offen) dieselbe Vokabel/Target-Definition nutzt — kein Parallel-Bau.

**AC:**
- M12-S07 (#232) referenziert die S08-Definition (Verben + scope-aware Target) statt eine eigene; `char:`/`session:`-Targets sind dort die von S08 reservierten Präfixe.
- Wird als AC-Ergänzung an #232 verankert (Issue ist offen → AC erweiterbar, kein Re-Open nötig).
- Keine doppelte Verb-/Target-Definition im Code.
- Tests: Abgleich erfolgt in M12-S07-Testdatei (dortige Vokabel == S08).

## Story Tracking

| Story | Prio | Titel | Issue |
|---|---|---|---|
| M14-S08 | p0 | Effekt-Vokabel & Target-Modell (normativ) | #263 |
| M14-S09 | p0 | Effekt-Assertions am Event speichern | #264 |
| M14-S10 | p0 | Derived World-State-Projektion | #265 |
| M14-S11 | p1 | Ad-hoc World-Variablen & Entity-Status-Timeline | #266 |
| M14-S12 | p1 | Effekt-Editor im Event-Formular | #267 |
| M14-S13 | p1 | Konsum — Entity-Status am Kalender-Tag | #268 |
| M14-S14 | p1 | M12-S07 auf geteiltes Target-Modell angleichen | #269 |

## Abhängigkeiten

- **EPIC-021 (β):** Events tragen `properties.effects`; γ füllt/liest sie.
- **M12-S07 (#232, offen):** teilt die Effekt-Vokabel; S14 gleicht an. S08 ist der gemeinsame normative Anker.
- **EPIC-020 (α):** Datums-Widget für Effekt-`day` (S12).
- **M5 time-events-world-state-light:** dieser Epic ist die konkrete Ausführung des „world-state"-Teils.
