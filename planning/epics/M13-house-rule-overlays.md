# EPIC-019: House-Rule Overlays

## Goal

Eine Gruppe kann die mechanischen Regeln eines Basis-Systems (Rest, Crit, Proficiency, Ressourcen …)
**übersteuern oder erweitern**, ohne das System-Plugin zu forken. Overrides leben in **House-Rule-Modulen** —
benannten, wiederverwendbaren Bündeln von *keyed patches*, die einzelne Basis-Deklarationen über ihre
**stabile ID** targeten (M9-Decision 21, M12-Decision 12). Module werden **pro Session an-/ausgeschaltet** —
Hausregeln sind das, worauf sich die Gruppe (Session) einigt. Der aktive Modul-Stack bildet über der Basis
das *effektive Regelwerk*, deterministisch aufgelöst.

Kern-Metapher: Die alternative Regel *auszudrücken* geht schon heute mit dem vorhandenen Primitiv-Set
(eine andere `transition:long_rest`, ein anderes `bands:attack`). Was dieses Epic hinzufügt, ist der
**Overlay-/Override-Layer**, der so eine Alternative *einzelne* Basis-Deklaration überschatten lässt.

Reused, nicht neu gebaut: Module sind **Overlay-Plugins** (M6-Framework), und das Scoping nutzt das *eine*
Override-Modell (nicht ein drittes neben `campaign_entity_overrides`, per-Spieler-Visibility (M10),
Cross-Session-State (#156)).

## Decisions

1. **Override = keyed patch, kein Fork.** Ein Modul targetet Basis-Deklarationen per **stabiler ID** mit einer Operation (`replace` / `patch` / `add` / `remove`). Hängt an M9-Decision 21 + M12-Decision 12 (jede Deklaration adressierbar).
2. **House-Rule-Modul = Overlay-Plugin.** Nutzt M6-Manifest/Loader; Manifest deklariert `overlays: <system_id>` und trägt Override-Entries statt eines vollen Systems. **Kein neuer Loader.**
3. **Session-scoped Aktivierung.** Eine Session deklariert, welche Module aktiv sind (geordnet). An-/Ausschalten pro Session; Modul-*Definitionen* sind über Sessions/Kampagnen hinweg wiederverwendbar. Bindung an M8-S01 (#152).
4. **Deterministische Auflösung.** Effektives Regelwerk = Basis ⊕ aktive Module in Aktivierungs-/Prioritäts-Reihenfolge; **last-wins pro Key**; Konflikte werden erkannt und angezeigt. Der Resolver erzeugt genau die Deklarations-Menge, die die M9-/M12-Engines konsumieren — **die Engines wissen nichts von Overlays**.
5. **Override-Operationen:** `replace` (ganze Deklaration ersetzen), `patch` (Felder mergen — z.B. nur die Crit-Schwelle eines Band-Sets), `add` (neue Deklaration), `remove`/`disable`.
6. **Validierung gegen Basis.** Ein Modul, das eine **nicht existierende** Basis-ID targetet → Validator-Fehler (kein stilles No-op). Schützt vor Drift, wenn das Basis-Plugin sich ändert.
7. **Module dürfen auch *ergänzen*, nicht nur überschreiben.** Neue Ressource, neues Band-Set, neue Regel-Entity — Homebrew-Zusätze fahren auf derselben Schiene wie Overrides.
8. **Ein Override-Modell.** Dasselbe Scoping-Konzept wie Content-Overrides / per-Spieler-Visibility (M10) / Cross-Session-State (#156). **Kein drittes Spezialsystem.** Gemeinsamer Overlay-Layer (System × Kampagne × Session).
9. **Ad-hoc Session-Override = unbenanntes session-lokales Modul.** Ein schneller DM-Tweak (eine einzelne Regel) nutzt dieselbe Entry-Form, ohne dass ein teilbares Modul autoriert werden muss.
10. **Nur Reconfiguration, keine neuen Primitive.** Eine Hausregel kann bestehende Deklarationen (die existierende Primitive nutzen) umkonfigurieren/ersetzen — sie kann **kein** neues Engine-Primitiv erfinden. Alternative Rest/Crit/Prof sind Reconfiguration; ein völlig neues Würfelsystem wäre ein eigenes System-Plugin.

## Out of Scope

- Überschreiben der **Engine/Primitive** selbst (Hausregeln rekonfigurieren Deklarationen, erfinden keine neuen Primitive — Decision 10).
- Beliebiges Scripting (nur deklarative Patches).
- Cross-System-Overlays (ein Modul targetet *ein* Basis-System).
- Live-Netz-Sync der Toggle-Zustände (das ist M10-Transport; hier nur das Modell).
- Automatisches Erraten von Konflikt-Auflösung jenseits der definierten Reihenfolge (Konflikte werden *angezeigt*, nicht heuristisch „gelöst").

## Stories

### M13-S01: Override-Entry-Modell & stabile Ziel-IDs

**Ziel:** Das Datenmodell eines einzelnen Overrides — was wird getargetet, mit welcher Operation, welchem Payload. Fundament für alles Weitere; formalisiert die Nutzung der stabilen IDs (M9-D21 / M12-D12).

**AC:**
- Entry-Form: `{ "target": "<stabile ID, z.B. transition:long_rest>", "op": "replace"|"patch"|"add"|"remove", "value": <deklaration|teil-deklaration> }`.
- `patch` merged Felder in die Basis-Deklaration (z.B. nur `bands.attack.crit.when`), `replace` ersetzt sie ganz.
- Ziel-ID-Auflösung gegen die kombinierte M9/M12-Deklarations-Registry (Formeln, Tabellen, Roll-Targets, Bänder, Ressourcen, Transitions, Hooks).
- Unbekannte Ziel-ID → klarer Fehler (Decision 6).
- Unit-Tests (`m13-s01-`): `patch` auf ein Band-Set ändert nur die Crit-Schwelle; `replace` einer Transition; `remove` einer Deklaration.
- `database` prop `DatabaseLike`; keine `eval()`.

---

### M13-S02: House-Rule-Modul als Overlay-Plugin

**Ziel:** Ein Modul ist ein Overlay-Plugin — es nutzt das M6-Manifest/Loader-Framework, deklariert ein Basis-System und trägt Override-Entries.

**AC:**
- Manifest: `"overlays": "<system_id>"` (z.B. `dnd5e_srd`), `entity`/`rules`-Overrides als Entry-Listen (M13-S01).
- Wird vom bestehenden Plugin-Loader geladen (kein neuer Ladepfad); als Overlay-Typ erkannt (`type: overlay` o.ä.).
- **Validierung beim Laden:** alle Ziel-IDs existieren im deklarierten Basis-System, sonst Fehler mit klarer Meldung (Decision 6).
- Ein Modul darf auch `add`-Entries (neue Ressource/Band/Regel) tragen (Decision 7).
- Unit-Tests (`m13-s02-`): Overlay-Plugin lädt, validiert Ziel-IDs; Modul mit ungültiger Ziel-ID wird abgelehnt.
- `database` prop `DatabaseLike`.

---

### M13-S03: Overlay-Resolver (Basis ⊕ aktive Module → effektives Regelwerk)

**Ziel:** Der Resolver, der aus Basis-System + geordnetem aktivem Modul-Stack die *effektive* Deklarations-Menge erzeugt, die M9/M12 konsumieren.

**AC:**
- Auflösung: Basis → Module in Aktivierungs-/Prioritäts-Reihenfolge; **last-wins pro Ziel-ID**; `patch` mergt, `replace`/`add`/`remove` wie definiert.
- Output ist die gleiche Deklarations-Form wie ein Basis-Plugin → M9/M12-Engines bleiben **overlay-agnostisch**.
- **Konflikt-Erkennung:** zwei aktive Module targeten dieselbe ID → als Konflikt markiert (Reihenfolge entscheidet, aber es wird sichtbar gemacht — Decision 4).
- Deterministisch & reproduzierbar; als reine Funktion `(basis, module[]) → effektiv` testbar.
- Unit-Tests (`m13-s03-`): Gritty-Rest überschattet `transition:long_rest`; zwei Module auf `bands:attack` → definierte Reihenfolge + Konflikt-Flag.
- `database` prop `DatabaseLike`; keine `eval()`.

---

### M13-S04: Session-Aktivierung & Toggle

**Ziel:** Eine Session hält die Liste aktiver Module (geordnet); an-/ausschalten pro Session. Der „Sammlung von Hausregeln, die man pro Session aktivieren/deaktivieren kann"-Kern.

**AC:**
- Session-Schema (#152) um `active_overlays: [ { module_id, order, enabled } ]` erweitert.
- An-/Ausschalten eines Moduls für die aktive Session; Reihenfolge änderbar.
- Wirkt sofort: das effektive Regelwerk (M13-S03) wird neu aufgelöst.
- Modul-Definitionen sind über Sessions hinweg wiederverwendbar (Bibliothek); Aktivierung ist session-lokal.
- Unit-Tests (`m13-s04-`): Modul in Session A aktiv, in Session B nicht → unterschiedliches effektives Regelwerk für denselben Charakter.
- `database` prop `DatabaseLike`; session-scoped Persistenz; keine `prompt()/alert()/confirm()`.

---

### M13-S05: Ad-hoc Session-Override

**Ziel:** Ein schneller DM-Tweak einer einzelnen Regel, ohne ein teilbares Modul zu autorieren — als unbenanntes session-lokales Modul.

**AC:**
- Die Session kann eigene Override-Entries (M13-S01-Form) direkt halten (implizit „Session-Modul", immer zuoberst im Stack oder mit definierter Priorität).
- Gleiche Entry-Form/Validierung wie ein echtes Modul (Decision 9) — kein Parallel-Weg.
- Optional promotebar zu einem benannten, teilbaren Modul.
- Unit-Tests (`m13-s05-`): Session-lokaler `patch` auf `bands:attack` wirkt nur in dieser Session.
- `database` prop `DatabaseLike`.

---

### M13-S06: Konflikt-Erkennung & Validierungs-UX

**Ziel:** Konflikte zwischen aktiven Modulen und Validierungsfehler klar an den DM kommunizieren.

**AC:**
- Zwei aktive Module auf derselben Ziel-ID → sichtbarer Konflikt-Hinweis mit Gewinner (per Reihenfolge) und Verlierer.
- Modul targetet nicht existierende Basis-ID → Ladefehler mit Modul-/ID-Nennung.
- Anzeige „was überschreibt dieses Modul" (Liste der getargeteten IDs + Operation).
- Alle Meldungen als gerendertes UI (keine `alert()`), i18n-fähig (M11).
- Unit-Tests (`m13-s06-`): Konflikt-Detektion liefert Gewinner/Verlierer; Diff-Liste eines Moduls.
- `database` prop `DatabaseLike`.

---

### M13-S07: UI — Modul-Bibliothek & per-Session-Toggle

**Ziel:** Der DM durchsucht verfügbare House-Rule-Module, schaltet sie pro Session an/aus, sieht was sie ändern.

**AC:**
- Modul-Bibliothek: Liste verfügbarer Overlay-Module (mit Basis-System, Beschreibung, getargeteten IDs).
- Per-Session-Toggle-Liste (aktivieren/deaktivieren, Reihenfolge), gebunden an die aktive Session (M13-S04).
- Diff-Vorschau: was ein Modul gegenüber der Basis ändert (nutzt M13-S06).
- Keine hartcodierten Strings (M11 `t()`); keine `prompt()/alert()/confirm()`.
- `database` prop `DatabaseLike`.

---

### M13-S08: Beispiel-Module (dnd5e_srd)

**Ziel:** 2–3 mitgelieferte House-Rule-Module beweisen die Schiene end-to-end.

**AC:**
- `gritty_realism` (Overlay auf `dnd5e_srd`): `patch`/`replace` auf `transition:short_rest` (= 8h) und `transition:long_rest` (= 7 Tage).
- `crit_19_20`: `patch` auf `bands:attack` → Crit-Schwelle `roll >= 19`.
- `max_crit_damage`: `replace`/`patch` auf den Crit-Damage-Hook (M12-S07) → max Würfelwert + Wurf statt doppelter Würfel.
- Alle laden fehlerfrei, validieren gegen `dnd5e_srd`-IDs, und ändern bei Aktivierung nachweislich das effektive Regelwerk.
- Unit-Tests (`m13-s08-`): mit `gritty_realism` aktiv liefert die Long-Rest-Aktion 7-Tage-Semantik; mit `crit_19_20` ist 19 ein Crit.
- Kein proprietärer Inhalt; nur SRD-kompatible Mechanik-Overrides.

---

## Story Tracking

| Story | Prio | Titel | Issue |
|---|---|---|---|
| M13-S01 | p0 | Override-Entry-Modell & stabile Ziel-IDs | #236 |
| M13-S02 | p0 | House-Rule-Modul als Overlay-Plugin | #237 |
| M13-S03 | p0 | Overlay-Resolver (Basis ⊕ aktive Module) | #238 |
| M13-S04 | p0 | Session-Aktivierung & Toggle | #239 |
| M13-S05 | p1 | Ad-hoc Session-Override | #240 |
| M13-S06 | p1 | Konflikt-Erkennung & Validierungs-UX | #241 |
| M13-S07 | p1 | UI — Modul-Bibliothek & per-Session-Toggle | #242 |
| M13-S08 | p1 | Beispiel-Module (dnd5e_srd) | #243 |

**Reihenfolge:** S01 (Entry-Modell) → S02 (Overlay-Plugin) → S03 (Resolver) → S04 (Session-Toggle) sind die tragende Achse. S05–S08 bauen darauf.

## Abhängigkeiten

- **M9-Decision 21 + M12-Decision 12** — jede Deklaration per stabiler ID adressierbar (harte Voraussetzung; muss in M9/M12-Stories mitgezogen werden).
- **M6 Plugin-Framework** — Overlay-Module sind Plugins (kein neuer Loader); koppelt an die #225-Konsolidierung (ein `dnd5e_srd`-Basissystem).
- **M8-S01 (#152)** — Session hält die aktiven Overlays.
- **M12** (Resolution-/Resource-Layer) — liefert die überschreibbaren Transitions/Bänder/Ressourcen; die spannendsten Hausregeln (Rest, Crit) sitzen dort.
- **Ein Override-Modell** — gemeinsames Scoping mit `campaign_entity_overrides`, per-Spieler-Visibility (M10), Cross-Session-State (#156); kein drittes System (Decision 8).
