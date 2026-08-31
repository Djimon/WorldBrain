# Plugin-Substrat — Reifegrad-Analyse & Roadmap (M9 + Overlays)

> **Status:** DRAFT für Epic-/Issue-Ableitung · **Datum:** 2026-08-31 · **Methode:** 4 parallele Code-Audits (Engine, Loader/Substrat, Consumer-UI, Plugin-Daten) gegen den Ist-Stand auf `master`.
> **Zweck:** Ehrliche Bestandsaufnahme, *was* an den bereits geschlossenen M9-Stories real ist, *was* Fassade ist, und welche Epics/Issues nötig sind, damit importierte Regelbasen tatsächlich konsumierbar werden.
> **Nicht-Ziel dieses Dokuments:** der Bastion-Manager / Feature-Plugins im Detail — die stehen nur als Ausblick (§9), damit die heutige Reife von **System-Plugins** und **Overlay-Plugins** im Fokus bleibt.

---

## 1. TL;DR (Executive Summary)

Die Leitfrage dieser Analyse war zweiachsig: **(A) Werden importierte Regelbasen irgendwo konsumiert?** und **(B) Sind sie überhaupt reif genug, um konsumiert zu werden**, sobald die Consumer (interaktiver Bogen, Kampf-/Feature-Systeme) gebaut werden?

- **Achse A — Konsum: praktisch nirgends.** Regeln werden beim Projekt-Öffnen in eine In-Memory-Registry geladen und in **leere DB-Skelett-Tabellen** „materialisiert", die **kein Feature je liest oder schreibt**. Kein laufendes System wertet `mechanics`/`resource_types` aus (nur der Validator liest sie). Der einzige nominelle Consumer (Charakterbogen) ist ein **fremder Milestone-Bogen** (M10-Multiplayer), der das Schema ignoriert.
- **Achse B — Reife: stark geteilt.**
  - **Regelbasis-Daten (`dnd5e_srd`): reif** (für eine Klasse) — konsistenter Formel-/Lookup-/Referenz-Graph, **0 dangling refs**, korrekte 5e-Zahlen beweisbar.
  - **Rechen-Engine: im Kern reif**, aber mit **einem blockierenden Integrationsbug** (2D-Lookup wird vom Resolver nicht dispatcht → alle Spell-Slots liefern still `null`).
  - **Persistenz-Substrat (Loader→DB): nicht reif — Fassade.** Kein `INSERT`/`SELECT`, Doppel-Speichermodell, Validierung/Registry nur in Tests verdrahtet.
  - **Consumer-Schicht (UI, die Regeln in Gameplay gießt): existiert nicht.**

**Einordnung in einem Satz:** Wir haben eine reife Regel-*Datenbasis* und einen im Kern echten *Rechenkern* — aber **kein lebendes Persistenz-Substrat und keinen Consumer**; die Regeln hängen frei.

### Reife-Stack (Überblick)

| Schicht | Verdikt | Konsumiert? | Reif genug? |
|---|---|---|---|
| 1. Regelbasis-Daten (`dnd5e_srd` JSON) | REAL, konsistent | nur geladen | **JA** (1 Klasse) |
| 2. Rechen-Engine (`formula-engine`/`condition-engine`) | REAL + 1 Blocker-Bug | nur Service-Layer, nie UI | **FAST** |
| 3. Persistenz-Substrat (Loader→DB) | FASSADE | tote Tabellen | **NEIN** |
| 4. Consumer (Bogen, Kampf, Feature-Views) | EXISTIERT NICHT | — | **NEIN** |

---

## 2. Scope & Methode

Vier unabhängige Read-Only-Audits, jeweils mit Datei/Zeilen-Belegen:

1. **Engine:** `src/services/formula-engine.ts`, `condition-engine.ts`, `plugin-table-loader.ts` + Tests `m9-s02/07/09/10/11`.
2. **Loader/Substrat:** `plugin-loader.ts`, `plugin-schema-loader.ts`, `plugin-entity-service.ts`, `plugin-validator.ts`, `plugin-ref-validator.ts`, `plugin-declaration-registry.ts`, `plugin-i18n-service.ts`, `plugin-asset-service.ts`, `overlay-plugin-loader.ts`, `App.tsx` + Tests `m9-s01/08/11`.
3. **Consumer-UI:** `PlayerCharacterSheet.tsx`, `CreatureStatBlock.tsx`, `PluginManager.tsx`, `PlayModeView.tsx` + DOM-Tests `m9-s03/04/05`.
4. **Plugin-Daten:** alle `plugins/**` (dnd5e_srd + 4 weitere).

Ergänzt um einen Consumer-Grep (wer importiert Engine/Loader zur Laufzeit; gibt es eine Kampf-Engine).

---

## 3. Plugin-Taxonomie (Begriffsklärung für abgeleitete Issues)

Damit Folge-Issues eindeutig sind, drei Klassen sauber getrennt:

- **System-Plugin** — ganzes Regelwerk. Manifest: `system:true`, Pflicht-`db_prefix`, `mechanics`-Block, `entity_types/*.json` (+ `tables/`, `locales/`, `examples/`). Beispiel: `dnd5e_srd`, Toy: `roll_under_demo`.
- **Overlay-Plugin (Homebrew/Hausregel)** — kleiner Regel-Patch auf ein System. Manifest: `kind:"overlay"`, `overlays:"<system>"`, `overrides:[…]` gegen stabile Deklarations-IDs. Kein eigener `db_prefix`, keine Entity-Typen. Beispiele: `crit_19_20`, `gritty_realism`, `max_crit_damage`.
- **Feature-Plugin (Ausblick, noch nicht existent)** — erweitert ein System um ein ganzes Sub-System **inkl. eigener Views + DM/Player-Rechteaufteilung** (z.B. Bastion-Manager). Siehe §9.

---

## 4. Schicht 1 — Regelbasis-Daten (`dnd5e_srd`)

**Verdikt: REAL & intern konsistent, aber Ein-Klassen-Scheibe.**

**Zahlen:** 114 Felder · 32 Formeln · 10 Lookups · 14 session-state · 3 ref-Felder.

**Stark:**
- `plugin.json`: `system:true`, `db_prefix:"dnd5e"`, voller `mechanics`-Block (attributes str..cha, resource_types hp/spell_slots_1..9/hit_dice, distance_units ft/mile, challenge_metric cr), **SRD CC-BY-4.0-Attribution vorhanden**.
- `player_character.json`: alle 6 Ability-Mods (`floor((x-10)/2)`); alle 18 Skills mit `proficient_*`/`expertise_*`/`*_mod`-Triple, **proficiency-gated via 0/1-Flag-Multiplikation**; `ac_total` als Conditional `if(is_unarmored, 10+dex_mod, armor_ac)`; 6 Saves; passive perception. **Dangling-Check: 0** — jeder Formel-Bezeichner löst auf ein deklariertes Feld auf.
- `tables/prof_by_level.json`: korrekte 1D-Threshold-Form. `tables/spell_slots_1..9.json`: korrekte 2D-Form (`class → level → n`).
- `examples/player_characters/aria.json` (Wizard L5): übt **alle** Kategorien aus; alle 4 Refs lösen auf (species→elf, known_spells→fireball, feats→alert, inventory→healing-potion).

**Lücken (nicht kaputt, aber „vollständig"-widerlegend):**
- **Spell-Slot-Tabellen enthalten nur `wizard`** → mechanisch spielbar für genau eine Klasse.
- **Locales ~10/114 Felder** lokalisiert (Ability-Scores, Mods, Saves, 18 Skills fehlen); en/de je 16 Keys, echt aber dünn.
- **`examples/creatures/goblin.json`:** Feld `creature_type` existiert **nicht** im Schema (Schema-Feld heißt `type`) → Wert landet in undeklariertem Key; zudem fehlt `id` (harmlos, aber inkonsistent).

**Ehrliches Label:** vollständig verdrahteter **Single-Class-Vertical-Slice**, kein vollständiges 5e-Regelwerk.

---

## 5. Schicht 2 — Rechen-Engine

**Verdikt: im Kern REAL, ein blockierender Integrationsbug, nie in der UI.**

**Real & getestet (konkrete Zahlen, nicht nur Grep-Guards):**
- Handgeschriebener Recursive-Descent-Parser → gemeinsamer AST-Evaluator. **Kein `eval`/`new Function`** (grep-verifiziert, nicht nur Test-Grep).
- Arithmetik `+ - * /`, `floor/ceil/max/min`; Feld-Referenzen inkl. **verketteter** derived-Felder; **topologische** Auflösung; **Zyklenerkennung** → `null`/`—` statt Crash.
- 1D-Lookup `threshold` (größter Key ≤ Wert) + `exact`; Verkettung `lookup → formula`.
- Conditionals: Vergleiche `== != > >= < <=` (Präzedenz unter Arithmetik), `and/or/not`, `if(cond,then,else)` inkl. verschachtelt, Boolean→Zahl-Coercion.
- 2D-Lookup-Funktionen (`resolveLookup2D`, `evaluateLookupField2D`) — **isoliert** implementiert und getestet.

**Bug/Lücke:**
- **[BLOCKER] 2D-Lookup wird vom Resolver nicht dispatcht.** `resolveComputedFields` (der einzige Orchestrator) routet jede Lookup-Def an den **1D**-Pfad (`formula-engine.ts:360-361`); sein `tables`-Parameter ist 1D-typisiert (`:312`). Die realen `spell_slots_*_max` sind 2D → `key_field` `undefined` → **jeder Spell-Slot-Max = `null`** bei echter Voll-Sheet-Auflösung. Kein Test fängt es, weil 2D-Tests `evaluateLookupField2D` *direkt* rufen und Resolver-Tests nur 1D/Formeln nutzen.
- **Latent:** Lookup-Key kann kein computed field sein (Deps nur aus Formel-Strings gesammelt); unbekanntes Feld in einem *Vergleich* ergibt still `false`→`0` statt `—` (nur in Arithmetik korrekt `null`).
- **Nicht in der UI:** `resolveComputedFields` wird **nur aus Tests** aufgerufen; kein UI-Component importiert die Engine. Das „`—` statt Crash"-Verhalten ist damit in-app nicht demonstrierbar.

---

## 6. Schicht 3 — Persistenz-Substrat (Loader → DB)

**Verdikt: FASSADE. Der „tote Loader" wurde auf dem Papier wiederbelebt (eine Tabelle entsteht), bleibt aber funktional tot.**

**Was real läuft (der eine echte Ladepfad):**
```
App.initWorkspace (App.tsx:28-43)
 └─ openProjectDb(world.db)                       → echte SQLite
 └─ scanPlugins(pluginsDir)                       → nur JSON.parse, KEINE Validierung (plugin-loader.ts:33-47)
 └─ für jedes system-Plugin: loadPluginEntityTypes(...)  (App.tsx:36-40)
     └─ readTextFile(entity_types/<id>.json)      (plugin-schema-loader.ts:45)
     └─ registerPluginEntityType(...) → In-Memory-Map
     └─ db.execute("CREATE TABLE IF NOT EXISTS dnd5e_<id> (id TEXT PK, data_json TEXT)")  (:53-54)
```

**Warum Fassade:**
- Die `dnd5e_*`-Tabellen werden **leer angelegt und nie gefüllt oder gelesen** — kein `INSERT`, kein `SELECT`. Die 6 Beispiel-Entities werden **nie** materialisiert (kein Code liest `examples/`).
- **Doppel-Speichermodell:** Der reale Bogen persistiert in **`player_characters.sheet_json`** (Blob, `player-character-service.ts:35-68`) — **nicht** in `dnd5e_player_character`. Die materialisierten Tabellen sind Waisen.
- **Validierung/Ref-Check/Registry/Table-Loader/i18n existieren als korrekte Funktionen, werden aber nur von Tests aufgerufen** — nie im App-Ladepfad:
  - `validatePluginManifest` (`plugin-validator.ts:40-53`) prüft `mechanics`/`db_prefix` korrekt — aber `scanPlugins` ruft es nie → **ungültige System-Plugins laden trotzdem**.
  - `validateEntityTypeRefs` (`plugin-ref-validator.ts`) prüft `ref`/`ref[]`-Targets — vom Loader nie aufgerufen.
  - `plugin-declaration-registry` (stabile IDs `field:/formula:/table:`) — `registerDeclaration` wird zur Laufzeit **nie** aufgerufen → Registry bleibt leer.
  - `plugin-table-loader.loadPluginTable` nutzt einen **hardcodierten relativen Pfad** (`plugins/<id>/tables/…`), nicht den Projekt-Dir aus `App.tsx` → würde in-app gar nicht laden.
- **Prefix-Isolation der In-Memory-Registry fehlt:** `registerPluginEntityType` keyt nach nacktem `type.id` (`plugin-entity-service.ts:45`) → zwei Plugins mit `creature` kollidieren („second wins"). Nur die **Tabellen**namen sind prefix-isoliert (aber leer).

**Overlay-Konsum (Homebrew) — UNVERIFIZIERT, wahrscheinlich inert:** Overlays targeten stabile IDs (`bands:attack`, `transition:short_rest`, `hook:crit_damage`). Genau die Deklarations-Registry, die diese IDs adressierbar machen müsste, wird zur Laufzeit **nie befüllt** (s.o.). `overlay-plugin-loader.ts`/`override-entry.ts` existieren, ihr tatsächlicher Anwendungspfad in die Regelauswertung wurde **nicht tief auditiert** → als eigener Verifikations-Schritt markiert (§8, N-13).

---

## 7. Schicht 4 — Consumer (die Regeln → Gameplay macht)

**Verdikt: existiert nicht.**

- **M9-S03 Charakterbogen: PLACEHOLDER-MISSING.** Die Datei `PlayerCharacterSheet.tsx` ist der **M10-S08-Multiplayer-Bogen** (`#357`, Props `{store, campaignId, playerId, …}`), read-only Store-Sicht — **kein Schema, keine derived-Werte, keine editierbaren Ressourcen, kein Session-Log**. Rendert nur Name + Freitext-Summary + 3 Buttons (`:170-220`). Die M9-S03-AC-DOM-Tests sind **rot (8/10 fail)** — sie beschreiben einen Bogen-Contract, den es nicht gibt. (Die 2 grünen Tests sind trivial: „kein prompt/alert" + Smoke.)
- **M9-S04 Creature-Statblock: PARTIAL, aber Severe.** `CreatureStatBlock.tsx` rendert isoliert korrekt (Tests grün 11/11), ist aber **nirgends gemountet** → totes UI (das wiederkehrende „built-but-unmounted"-Muster, laut AGENTS automatisch Severe). Zudem **statisch** verdrahtet (fixes TS-`Creature`-Interface), nicht schema-getrieben; HP wird als String gedruckt, **Würfel nicht klickbar**.
- **`PluginManager`: gemountet & funktional** (`WorkspaceShell.tsx:801`) — listet Registry-Einträge, rendert aber selbst keine Entity-Formulare.
- **Engine erreicht die UI nie** (Folge aus §5).
- **Keine Kampf-Engine:** nur `EncounterMode` (ungemountete Encounter-Liste + Filter) und `dice-roller-service`/`DiceRollerWidget` — kein regelgetriebenes Kampfsystem.

---

## 8. Defekt-Register (1:1 Issue-Kandidaten)

Priorität nach AGENTS Bug-Priority (P0 = Security/Arch-Violation/Dead-Wiring; P1 = broken feature/anti-pattern; P2 = Vollständigkeit/Convenience).

| # | Defekt | Schicht | Prio | Beleg |
|---|---|---|---|---|
| N-01 | 2D-Lookup wird vom `resolveComputedFields` nicht dispatcht → Spell-Slots = `null` | Engine | **P1 (Linchpin)** | `formula-engine.ts:360-361,312` |
| N-02 | Loader materialisiert nie Daten (`CREATE TABLE`, aber kein `INSERT`/`SELECT`); Beispiele nie geladen | Substrat | **P0 (Arch/Dead-Loader)** | `plugin-schema-loader.ts:45-56` |
| N-03 | Doppel-Speichermodell `dnd5e_*` vs `player_characters.sheet_json` — unversöhnt | Substrat | **NEEDS_DECISION** | `player-character-service.ts:35-68` |
| N-04 | `validatePluginManifest`/`validateEntityTypeRefs` nie im Ladepfad → `mechanics`/`db_prefix`/refs nicht erzwungen | Substrat | **P1** | `plugin-loader.ts:33-47`, `plugin-validator.ts:40-53` |
| N-05 | Declaration-Registry (stabile IDs) zur Laufzeit nie befüllt | Substrat | **P1** | `plugin-declaration-registry.ts` |
| N-06 | M9-S03 Charakterbogen fehlt (Datei = fremder M10-Bogen); AC-Tests rot | Consumer | **P0 (Deliverable fehlt)** | `PlayerCharacterSheet.tsx:24-34,170-220`; `tests/m9-s03-*` |
| N-07 | `CreatureStatBlock` gebaut aber nirgends gemountet (Dead-Wiring) + statisch | Consumer | **P0 (Dead-Wiring)** | `CreatureStatBlock.tsx`; kein Mount-Referrer |
| N-08 | Engine nie in der UI verdrahtet (`resolveComputedFields` nur in Tests) | Consumer/Engine | **P1** | grep: nur Tests |
| N-09 | In-Memory-Registry nicht prefix-isoliert → Entity-Typ-Kollision | Substrat | **P2** | `plugin-entity-service.ts:45` |
| N-10 | `plugin-table-loader` hardcodierter Pfad, ignoriert Projekt-Dir | Substrat | **P2** | `plugin-table-loader.ts:7-18` |
| N-11 | `dnd5e_srd` Spell-Slot-Tabellen nur `wizard` | Daten | **P1 (Vollständigkeit)** | `tables/spell_slots_*.json` |
| N-12 | `dnd5e_srd` Locales ~10/114 Felder | Daten | **P2** | `locales/{en,de}.json` |
| N-13 | Overlay-Anwendungspfad in die Regelauswertung unverifiziert (wahrscheinlich inert mangels ID-Registry) | Substrat | **P1 (Verify)** | `overlay-plugin-loader.ts`, `override-entry.ts` |
| N-14 | `goblin.json` Feld `creature_type` ≠ Schema `type`; fehlende `id` | Daten | **P2** | `examples/creatures/goblin.json` |
| N-15 | Latent: unbekanntes Feld im Vergleich → still `false` statt `—` | Engine | **P2** | `condition-engine.ts:86-87` |

---

## 9. Ausblick — Feature-Plugins (Rahmen + getroffene Grundsatz-Entscheidungen)

Nicht Teil der heutigen Reife, aber der logische nächste Plugin-Typ (z.B. Bastion-Manager). Kernpunkte, damit sie hier nicht verloren gehen:

- Feature-Plugins brauchen **eigene Logik + eigene Views** — rein deklarativ nicht realistisch. Also: **Code hinter einer Capability-Grenze** (isolierte WebView/IPC; Plugin greift nur über eine deklarierte Plugin-API zu, kein direkter DB-/FS-/Netz-Zugriff), **nicht** „darf alles".
- **DM/Player-Trennung hängt nie am Plugin-Vertrauen**, sondern an **zwei Host-Invarianten**: (1) der Host **filtert alle ausgehenden Daten** (Player-Plugin kann nur rendern, was es bekam); (2) **jede Zustandsänderung ist ein host-validierter Intent**. Beides existiert bereits aus M10 — Kontext für Fremdleser: **D29** = der Host (DM) hält die einzige DB, der Player-Client ist DB-los und rendert nur aus einem transport-gespeisten Store; **Decision 8** = Token/Zugehörigkeit werden host-seitig **pro Nachricht** geprüft, der Client entscheidet nie selbst. Umgesetzt in `player-content-filter-service` (Ausgangs-Filter) und im `move_own_token`-Muster (Token-Move-Intent → Host validiert → Broadcast). Wird nur genutzt, nicht neu erfunden.
- **Vertrauensmodell phasenweise:** V1 „auf eigene Verantwortung" (lokaler Install, wie FoundryVTT/Obsidian) → V2/V3 kuratierte „trusted"-Freigabe im Plugin-Manager. Ein Injection-Scanner ist ein **Signal fürs Badge, kein Sicherheitsbeweis**.

### 9.1 Zwei-Achsen-Klassifikation (entschieden — MC-Mod-Modell)

Zwei **orthogonale** Achsen, nicht vermischen:

- **Koordinations-Achse (wie MC Server-/Client-Mods):**
  - **Client-optional** — rein optische / Quality-of-Life-Plugins, die *bestehende* Info anders darstellen. Jeder Player installiert lokal nach Belieben; keine Abstimmung nötig; kein Join-Gate.
  - **Content-mandatory** — ändern/erweitern echten Content. Der **Host** muss sie haben; beim Join wird geprüft, ob der Player sie (in kompatibler Version) hat.
- **Trust/Isolation-Achse (gilt für BEIDE Klassen):** jeder Plugin-Code läuft hinter einer **Capability-Grenze** (isolierte WebView/IPC, deklarierte API, kein direkter DB-/FS-/Netz-Zugriff). „Optional" ≠ „unbegrenzt".

### 9.2 Host-autoritative Nuance: Player braucht die *View*, nicht die *Logik*

Weil der Host autoritativ ist (D29), rechnet der Player nichts — er rendert nur. Ein Content-mandatory-Plugin zerfällt daher bevorzugt in **zwei Teile**:
- **Host-Teil** (Logik/Regeln) — nur der DM installiert ihn (vertraute Seite).
- **Player-View-Teil** — nötig zum Darstellen/Bedienen; **möglichst deklarativ** (Panel aus Primitives, host-gefütterte Daten) → braucht oft **keinen** fremden Player-Code. Nur UI-schwere Views brauchen Code+Sandbox.

Das senkt die „fremder Code auf jedem Player"-Fläche drastisch.

### 9.3 Join-Install-Flow (dockt an den bestehenden Join-Transport-Handshake aus #387 an)

> Kontext für Fremdleser: **#387** = der Beitritt/Reconnect läuft als Transport-Handshake (`join_request`/`join_response` über den P2P-Kanal), host-autoritativ validiert — nicht über eine geteilte DB.

`join_request` trägt die installierte Plugin-Menge (id+Version) → Host vergleicht mit den Content-mandatory-Plugins der Campaign → fehlt/inkompatibel: `join_response{ ok:false, error:'plugins_required', payload:[{id, version, hash, url, enforcement}] }` → Player-Prompt (zeigt Capabilities) → bei „ja" On-the-fly-Download → **Reconnect**. Lehnt der Player ab → keine Teilnahme (bei `enforcement:"block"`). Kein neuer Kanal — Erweiterung des bestehenden Handshake-Schemas.

### 9.4 Sicherheits-Mindestanforderungen (AC-Kandidaten, nicht verhandelbar)

- **Hash-/Signatur-Pinning:** Host sendet erwarteten Content-Hash; Player installiert nur bei Match (bare URL = MITM-offen; Supply-Chain-Risiko à la *fractureiser*).
- **Consent zeigt Capabilities**, nicht nur „ja" (Zwangs-Consent beim Join braucht informierte Zustimmung); HTTPS-Pflicht; V2/V3: Registry-ID+Version statt Roh-URL.
- **Klassen-Label host-erzwungen, nicht geglaubt:** mutierende Intents akzeptiert der Host nur von einem für die Campaign registrierten Content-Plugin (Fake-„kosmetisch" prallt an Invariante 2 ab).
- **Versions-Kompatibilität** wird beim Join geprüft (nicht nur „vorhanden").

**Entschieden (§12.6a):** `enforcement` als Manifest-Flag pro Plugin — hartes `block` (Join verweigert) für fundamentale Systeme vs. weiches `degrade` (Player joint, Feature-Tab ausgegraut „benötigt Plugin X") für nicht-kritische.

**Wichtige Erkenntnis:** „Plugin bringt eine Play-Mode-View (Schema + UI + Audience) mit" ist **dasselbe fehlende Substrat** wie der interaktive Charakterbogen. Bogen, Bastion-Manager, Spell-Manager sind alle **Instanzen einer einzigen fehlenden Mechanik**. Baut man diese generisch, fällt der Rest als Spezialfall heraus.

---

## 10. Stärkste Beweis-Tests (Ground-Truth herstellen)

Diese Tests machen den Ist-Zustand schwarz-auf-weiß und werden selbst zu Test-Issues:

- **T-1 (Engine-Golden, deckt N-01 auf):** Reale `player_character.json` + reale `tables/*.json` laden, `resolveComputedFields` für `aria` (Wizard L5) fahren, Golden-Werte asserten: `prof_bonus=3`, `dex_mod=3`, `ac_total=13`, `arcana_mod=9` (Expertise), `int_save=6`, `passive_perception=14`, **`spell_slots_1/2/3_max = 4/3/2`**. → *Fällt heute* an den Spell-Slots (`null`).
- **T-2 (Loader→SQLite, deckt N-02 auf):** `dnd5e_srd` real durch `loadPluginEntityTypes` in eine echte `node:sqlite`-DB; asserten dass `dnd5e_*`-Tabellen **befüllt** sind und `aria`s Refs auflösen. → *Fällt heute* (nie ingested).
- **T-3 (Daten-Integrität, deckt N-14 auf):** Für jede Beispiel-Datei jeden Key gegen das Schema prüfen. → *Fällt heute* an `goblin.creature_type`.
- **T-4 (Mount/Reachability, deckt N-06/N-07 ab):** Integrationstest, der Play-Mode über den echten Parent rendert und asserten, dass ein schema-getriebener Bogen bzw. der Statblock über einen echten User-Pfad erreichbar ist.

---

## 11. Roadmap — Epic-Kandidaten

Gruppiert; Reihenfolge = Abhängigkeit. Konform zu den Entscheidungen in §12.

**Sequenz-Leitplanke (§12.2 ↔ §12.3):** Der *erste sichtbare Slice* ist der **Wizard-Bogen end-to-end**; Fundament (EPIC-A/B) wird entlang genau dieser Bahn repariert, nicht vorab breit. Aber **„reif" ist erst mit Multi-Class erreicht (§12.3)** — deshalb ist EPIC-D **Pflicht-Pfad, nicht „später"**.

- **EPIC-A — Substrat-Reparatur (Fundament).** N-02, N-04, N-05, N-09, N-10. **Richtung fixiert (§12.1): Entity-Instanzen leben real in `<prefix>_*`-Tabellen; `player_characters.sheet_json` wird abgelöst** (Ingestion + Lese-/Schreibpfad + Migration). **`examples/` werden als echte Seed-Daten mit-ingested (§12.5).** Validierung/Refs/IDs greifen im Ladepfad. **Blockiert alles andere.**
- **EPIC-B — Engine-Vollintegration.** N-01, N-08, N-15. Ziel: `resolveComputedFields` dispatcht 2D, Engine ist der eine Ableitungs-Kern für die UI. Golden-Test T-1 als Abnahme.
- **EPIC-C — Consumer: Plugin-getriebene Play-Mode-View (generisch).** N-06, N-07. Ziel: der generische „Plugin contributed eine View"-Rahmen; **erster Durchstich = Wizard-Charakterbogen** (derived read-only, Ressourcen editierbar, Session-Log), zweite Instanz = Creature-Statblock erreichbar. Zieht aus EPIC-A/B nur, was diese Bahn braucht (§12.2). Setzt EPIC-A + B voraus.
- **EPIC-D — `dnd5e_srd` Vollständigkeit (PFLICHT für „reif", §12.3).** N-11, N-12, N-14. Ziel: alle Klassen (volle Spell-Slot-Tabellen), Locales vollständig, Beispiele sauber. **Reife-Gate** — ohne EPIC-D gilt das Substrat nicht als reif.
- **EPIC-E — Overlay-Konsum (Homebrew wirklich wirksam).** N-13 + N-05. Ziel: Overlays targeten reale, registrierte Deklarations-IDs und werden in der Auswertung angewandt. Setzt EPIC-A (Registry) voraus; **folgt zeitlich nach EPIC-C (§12.4)**.
- **EPIC-F (Zukunft/V2) — Feature-Plugin-Klasse.** §9.1–9.4: Zwei-Achsen-Klassen (optional/mandatory × view-only/code), Capability-API + Isolation, Join-Install-Flow über #387-Handshake, Hash-Pinning + Capability-Consent, DM/Player-Audience via Host-Invarianten. Setzt EPIC-C (View-Rahmen) voraus.

**Issue-Strategie (§12.7):** Aus diesem Doc **neue, cold-read-taugliche Epics/Issues** (Milestone-verlinkt); die alten M9-Issues (S03/S04/S06) nur als Kontext referenzieren, **nicht** reopen.

---

## 12. Entscheidungen

### Getroffen (2026-08-31)

| # | Frage | Entscheidung |
|---|---|---|
| 12.1 | Speichermodell (blockiert EPIC-A) | **Prefix-Tabellen real machen, `sheet_json` ablösen.** Entity-Instanzen leben in `<prefix>_*`; Ingestion + Lese-/Schreibpfad + Migration bauen. (Deckt sich mit M9-Epic-Decisions 10/11: Formel-/Schema-**Definition** lebt im Plugin-File, nur die **Werte** in der DB; session-veränderlicher State pro Session isoliert.) |
| 12.2 | Womit anfangen | **Sichtbarer Durchstich zuerst** (Wizard-Bogen end-to-end); Fundament nur entlang dieser Bahn mitziehen. |
| 12.3 | „reif genug"-Scope | **Multi-Class ist Pflicht für „reif"** — EPIC-D ist Reife-Gate, nicht optional. (Wizard-Slice ist der *erste* Schritt, nicht das Reifeziel.) |
| 12.4 | Overlay-/Homebrew-Timing | **Nach dem System-Plugin-Durchstich** (EPIC-E folgt EPIC-C; braucht ohnehin die ID-Registry aus EPIC-A). |
| 12.5 | Beispiel-Daten-Anspruch | **Echte geladene Seed-Daten (Produkt):** `examples/` werden beim Plugin-Load real in die Prefix-Tabellen ingested → sofort spielbarer Startinhalt. Erweitert EPIC-A-Ingestion + T-2. |
| 12.6 | Feature-Plugin-Modell | **MC-Mod-Modell** (§9.1–9.4): Client-optional (lokal) vs. Content-mandatory (Host + Join-Install-Flow); beide unter Capability-Sandbox; Player braucht View, nicht Logik; Hash-Pinning + Capability-Consent Pflicht. |
| 12.6a | Feature-Plugin `enforcement` | **Beides per Manifest-Flag** (`block` \| `degrade`): fundamentale Systeme blocken den Join, nicht-kritische degradieren (Feature-Tab ausgegraut). |
| 12.7 | Umgang mit closed M9-Issues | **Neue saubere Epics/Issues**, alte (S03/S04/S06) nur referenzieren, **nicht** reopen. |

**Alle §12-Punkte geklärt** — keine offenen Entscheidungen mehr; das Dokument ist bereit für die Epic-Ableitung (§11).
