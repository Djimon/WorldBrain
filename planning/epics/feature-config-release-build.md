# EPIC: Feature-Config & Release-Build-Härtung (Todo #4)

> **Status: SPEC-READY.** Grill-Session abgeschlossen (D1–D10 gelockt, Cut-Liste bestätigt).
> Stories unten definiert; Issue-Erstellung (Gold-Standard nach AGENTS.md) ist der nächste
> Schritt. S1 ist ein Spike, dessen Ergebnis S2/S3 schärft.

## Kontext (für Leser ohne Vorwissen)

Worlds and Beyond ist eine **Tauri-v2-Desktop-App**; der Renderer ist ein **Vite/Rollup-Bundle**
(`npm run build` = `tsc --noEmit && vite build` → `../dist`, das Tauri via `frontendDist`
+ `beforeBuildCommand` in die install-exe packt). Aktuell existiert **kein**
Feature-Flag-/Config-Mechanismus (Grep: keine `featureFlag`/`FEATURE_`/`isFeatureEnabled`).

Die App bündelt ihre Bereiche in `AREAS` (`src/ui/WorkspaceShell.tsx:97-113`):
`entities · search · maps · calendar · session · chronicle · cards · plugins · rules ·
audio · graph · project(settings) · play-settings`.

## Goal

Ein **Release-Build**, der **nur fertige Features** enthält — In-Dev-Features sind **echt
entfernt** (nicht nur der Mount ausgeblendet), sodass sie nicht im ausgelieferten Bundle
liegen. Der **Dev-Build** enthält weiterhin **alle** Features. Zusätzlich: Ballast (Tests/
Docs/Planning/.md) gehört nicht in den Release; `theme-tester.html` wird gesondert behandelt.

## Bekannte Vorgaben (aus Todo #4, wörtlich)

- Feature-Config für Release-Build: nur fertige Features konfigurieren; Dev-Build hat immer
  alle in Entwicklung befindlichen Features.
- „So gut es geht Feature **ganz entfernen**, nicht nur den Mount unsichtbar machen."
- Architektur-Review, ob genug gekapselt ist — oder ob **erst ein Refactor** ansteht.
- Auch Test-Kram, Docs, Planning-Files, `.md`-Files fliegen im Release raus.
  Ausnahme: `theme-tester.html` → ggf. nach `/themes/` verschieben — **NACH** install-exe.

## Feature-Scope 0.1 — per-Modus-Matrix (aus dem „Ist-drin"-Block des Orchestrators)

**Wichtig: das Gating ist PER MODUS** (edit × play), nicht global on/off.

| Feature | Edit 0.1 | Play 0.1 | Anmerkung |
|---|---|---|---|
| entities | ✅ | ✅ | |
| search | ✅ | ✅ | |
| maps | ✅ | ✅ | |
| calendar | ✅ | ✅ | |
| audio | ✅ | ❌ | edit-only (schon jetzt nicht in `PLAY_AREAS`) |
| graph | ✅ | ❌ | edit-only (schon jetzt nicht in `PLAY_AREAS`) |
| settings | ✅ | ✅ | **needs cleanup/polish** (→ #6 Settings-UX, läuft VOR #4) |
| lobby | — | ✅ | **needs refinement/clarification** (= Play-Cockpit/`session` im Play) |

## Cut-Liste 0.1 (raus in BEIDEN Modi)

- **chronicle** (📜) — vollständig raus.
- **cards** (🃏) — raus. ⚠️ **Abhängigkeit prüfen:** `CardPreview.tsx`/Card-Embed evtl. von
  maps/entities genutzt → im Architektur-Review verifizieren, bevor entfernt.
- **plugins (UI/🔌 = PluginManager)** — raus. ✅ **Aber das Plugin-SUBSTRAT bleibt**
  (`plugin-entity-service` / `plugin-declaration-registry` / `plugin-schema-loader` /
  `entity-type-schemas`) — es speist die Kern-Entity-Typen (Character/Location…). Nur die
  nutzer­sichtbare Verwaltungs-UI wird gegated. Deckt sich mit „plugin-substrate erst später".
- **rules** (📖, inkl. DM-Screen + rule-evaluations) — raus. ✅ Sauber: `rule-evaluations`
  wird nur im Rules-Bereich genutzt, nichts Aktives hängt dran.
- **edit-mode `session`-Pointer** — der Redirect-Hinweis-Bereich im Edit entfällt (Edit-Liste
  hat keinen Session/Play-Eintrag).

## Offene Abhängigkeiten / Unsicherheiten (abzustimmen)

- **A1 — GELÖST (D9): `features.json` bleibt FLACH** (`"cards": false`), **kein** per-Modus-
  `{edit,play}`. Begründung (Orchestrator): die Modus-Zugehörigkeit ist Wesensmerkmal des
  Features (audio/graph sind DM/edit-only *by nature*, lobby play-only) und lebt bereits im
  Code (`AREAS` vs `PLAY_AREAS`) — nicht im Release-Toggle. Das Gate entfernt ein Feature
  überall dort, wo es laut Code erscheint. Für 0.1 ausreichend (alle Cuts sind Voll-
  Entfernungen). Sollte je ein Feature *nur in einem Modus* release-gegated werden müssen
  (nicht wesens-, sondern reifegrad-bedingt), wird der Shape später erweitert — YAGNI jetzt.
- **A2 — lobby-Scope → GELÖST (D8):** eigene **Refinement-Story** (Play-Cockpit-Sub-Scope:
  welche Tabs Map/Kampflog/Spotlight/Free-Browse/Split sind 0.1). **Prerequisite für das
  Play-Gating** in diesem Epic — #4 gated Play erst, wenn diese Story steht.
- **A3 — cards-Embed-Abhängigkeit** (s. o., Architektur-Review).
- **A4 — settings-Polish** ist Voraussetzung (#6 vor #4) — reine UX, nicht Teil des Gatings,
  aber Release-Gate.

## Decisions (bestätigt — Grill-Runde 1)

- **D1 — Gating = Build-Zeit-Entfernung, gesteuert durch eine zentrale, laien-editierbare
  Config.** Tree-Shaking (unfertiger Feature-Code liegt NICHT im Release-Bundle), aber die
  Quelle der Wahrheit ist EIN deklaratives Config-File (yaml/json), das ein Nicht-Techie
  pflegt (Feature → released: true/false). Der Build liest die Config → erzeugt die
  Compile-Konstanten / konditionalen Imports. Kein Runtime-Config (Code bliebe im Bundle),
  kein Release-Branch.
- **D2 — `theme-tester.html` wird mit dem Release ausgeliefert** als `/themes/`-Tool (Nutzer
  kann Themes selbst bauen/testen). Genaue Ablage (bundled resource vs. appData-Ordner) →
  Packaging-Runde.
- **D3 — Install-Ordner muss clean sein** (nicht wie der aktuelle Repo-Root). 1–2 ausgewählte
  Dateien aus `docs/` dürfen mit in den Installer. Details → Packaging-Runde.
- **D4 — Cut-Liste wird aus einem „Ist-drin"-Block abgeleitet**, den der Orchestrator liefert;
  daraus leitet der Requirement-Agent „ist draußen" + Abhängigkeiten/Unsicherheiten ab.
- **D5 — „Dev-Build" = `tauri dev`** (via `start-dev.bat` → `npm run desktop:dev`). Der Dev-Run
  zeigt IMMER alle Features (`import.meta.env.DEV === true`). Ein gepackter Installer ist immer
  Release (config-gated). **Kein** Override-Flag — bewusst einfach gehalten (Nutzerwunsch).
- **D6 — Feature-Config = `features.json` im Repo-Root** (zero-dependency, laien-editierbar:
  `"cards": false`). Vite liest sie zur Build-Zeit → `define`-Konstanten → Tree-Shaking.
- **D7 — Nutzerdaten in `Dokumente\WorldsAndBeyond\`** (NICHT `%AppData%`, NICHT Install-Ordner):
  sichtbar, user-schreibbar, intuitiv; `projects/`, `plugins/`, `themes/` (+ theme-tester)
  leben dort, von der App bei First-Run angelegt/geseedet. Install-Ordner (Program Files) bleibt
  read-only/clean. Passt zu den bereits vorhandenen `fs:allow-document-*`-Capabilities.
  *(Begründung: Program Files ist für Nicht-Admins read-only → Apps schreiben Nutzerdaten nie
  dorthin. Documents ist der user-freundliche, sichtbare Ort statt des versteckten AppData.)*
- **D8 — lobby/Play-Cockpit-Scope = eigene Refinement-Story** (Prerequisite fürs Play-Gating).
- **D9 — `features.json` bleibt flach** (kein per-Modus), Modus-Zugehörigkeit lebt im Code.
- **D10 — Ausgelieferte Docs = EIN neues, kurzes User-How-To** (Kapitel „Für DMs" / „Für
  Player", je aktives Feature knapp erklärt) — als Resource gebündelt. `theme-tester.html`
  wird in den `themes/`-Ordner (unter `Dokumente\WorldsAndBeyond\themes\`) gelegt.
- **D11 — Gate-barer Feature-Umfang über die 0.1-Cut-Liste hinaus erweitert** (Orchestrator-
  Entscheid während S2-Umsetzung): der Mechanismus ist allgemein, daher werden zusätzlich zu
  chronicle/cards/plugins/rules auch **audio** und **graph** togglebar gemacht (beide in S2
  #404 mit umgesetzt + Bundle-Nachweis). **graph** gilt als EIN Feature über beide
  Nutzungsstellen — Graph-Bereich **und** Ego-Graph-Tab in der Entity-Ansicht verschwinden
  gemeinsam (GlobalGraphView + sigma/pixi/graphology tree-geshaked). **maps** und **session**
  sollen ebenfalls als je EIN ganzes Feature togglebar werden, sind aber groß + quer verdrahtet
  (maps: 7 MapViewer-Stellen + Play-Cockpit; session: Play-Cockpit + Transport) → eigene
  Folge-Stories **#412 (maps)** und **#413 (session)**, nicht Teil von S2. Befund dabei:
  `src/blocks/MapEmbedBlock.tsx` ist toter Code (kein Map-in-Entity-Text-Embed) — keine
  Fallback-Entscheidung nötig, kann im maps-Cut gelöscht werden. Der Immer-an-Kern bleibt
  (entities/search/calendar/settings/play-settings) — bewusst nicht gegatet (YAGNI + Footgun).
- **D12 — `session` ist eine bewusste Tree-Shaking-Ausnahme: Runtime-Hide statt echtem
  Entfernen** (#413). Das Play/Multiplayer-Subsystem (~200 Zeilen Transport-Orchestrierung:
  `WebRtcTransport` + Sync-Bridges + `play-client-store` + `campaign`/`play-context`, plus
  `enterPlay`/`handleModeToggle`/Join-Flow) ist zu tief in WorkspaceShell + das edit↔play-
  Modus-System verwoben, um es jetzt sicher in ein lazy Modul zu extrahieren (umkämpfte Datei,
  M10 in-progress, shippt in 0.1 an). Daher: `session=false` blendet via `feature('session')`
  den „Spielen"-Toggle aus (Cockpit unerreichbar) + `visibleAreas` versteckt den session-
  Bereich — der **Code bleibt im Bundle** (P2P-Libs nicht tree-geshaked). Das echte Entfernen
  (PlayShell-Extraktion) bleibt ein späterer Refactor, wenn der Shell nicht mehr umkämpft ist.
  **maps** dagegen (#412) ist voll tree-geshaked (MapsArea/MapViewer/PlayCockpitMap fallen bei
  `maps=false` aus `dist/` — edit **und** play-seitig).

## Cut-Liste bestätigt ✅

chronicle · cards · **plugins-UI (Substrat bleibt!)** · rules — raus in beiden Modi
(Orchestrator-OK). Details/Abhängigkeiten unten.

## Build-/Release-Pfad (Ist — verifiziert)

- **Release ist voll CI-automatisiert:** `.github/workflows/release_on_version.yml` triggert auf
  Push nach `master`, der `package.json` ändert. Vergleicht alte↔neue Version (major/minor/patch;
  gleiche Version → kein Build), dann `npm ci` → **`npm run desktop:build`** (= `tauri build`) →
  lädt den **NSIS-Installer** (`src-tauri/target/release/bundle/nsis/*.exe`) in ein **GitHub
  Release** `v<version>` (auto-notes). Aktuelle Version: `0.0.27`.
- `tauri build` ruft `beforeBuildCommand: npm run build` = `tsc --noEmit && vite build` → `../dist`;
  Tauri **embeddet das Vite-Frontend ins App-Binary**. `bundle.targets: ["nsis"]` (nur NSIS).
- `build.rs` = `tauri_build::build()` (trivial). `vite.config.ts` minimal (react-Plugin, kein
  `define`/mode). **Kein Feature-Flag-Mechanismus vorhanden.**
- **Konsequenz für D1:** das Release-Gating gehört in die **Vite-Build-Schicht** (nicht Rust).
  `vite build` (= jeder Release via CI) ist automatisch der Release-Pfad; `vite`/`tauri dev` der
  Dev-Pfad → `import.meta.env.PROD/DEV` unterscheidet sie **ohne** Extra-Flag. Die zentrale
  Config wird zur Build-Zeit gelesen → `define`-Compile-Konstanten → konditionale/dynamische
  Imports werden von Rollup tree-shaked (echtes Entfernen). Optionaler Override-Flag
  (`ALL_FEATURES=1`) für einen voll-featured QA-Installer bleibt offen (Grill-Frage).

## Offene Fragen (Grill-Session)

1. **Gating-Mechanismus:** Build-Zeit-Entfernung (Compile-Konstante + konditionale/dynamische
   Imports → Rollup tree-shaked den Code aus dem Release-Bundle) vs. Runtime-Feature-Config
   (Code bleibt im Bundle, nur unmounted — vom Nutzer ausgeschlossen) vs. Release-Branch mit
   real gelöschtem Code?
2. **Cut-Liste:** Welche In-Dev-Bereiche fliegen für 0.1 raus (chronicle/cards/plugins/rules)?
   Und gibt es **Sub-Features** innerhalb aktiver Bereiche, die raus sollen (z. B. in
   session/play: DM-Screen, Encounter, Whiteboard/Spotlight-Stub)?
3. **Ballast-Scope:** „Tests/Docs/Planning/.md raus" — nur der .exe-Bundle (der enthält sie
   ohnehin schon nicht) oder auch ein bereinigtes Source-/Release-Artefakt?
4. **theme-tester.html:** Mit dem Release als `/themes/`-Tool ausliefern, oder dev-only
   ausschließen? Was ist der Zweck für den Endnutzer?
5. **Feature-Config als Single Source:** Wo lebt die Konfiguration (ein zentrales Modul, das
   `AREAS` und Mounts speist)? Wie wird „finished vs in-dev" deklariert?
6. **Architektur-Review-Umfang:** Sind die Features an den Import-Grenzen sauber genug
   gekapselt für Tree-Shaking, oder braucht es zuerst einen Entkapselungs-Refactor (eigene
   Spike-Story)?
7. **Verifikation:** Woran misst man „ist wirklich raus"? (Bundle-Analyse/`dist`-Grep, dass
   der Feature-Code nicht enthalten ist.)

## Out of Scope (vorläufig — im Grill zu bestätigen)

- Runtime-Umschaltbarkeit von Features durch den Endnutzer (dies ist Build-Zeit-Config).
- Neue Features. Dieses Epic **entfernt/gate**, es baut nichts Neues.

## Code-Anker (Ist)

- Feature-Surface: `AREAS` in `src/ui/WorkspaceShell.tsx:97-113`; Mount via `renderArea()`
  `case '<id>':`; Sichtbarkeits-Gate `visibleAreas` (`:934-936`).
- Build: `package.json` (`build` = `tsc --noEmit && vite build`), `vite.config.ts` (minimal,
  kein `define`/mode-Setup), `src-tauri/tauri.conf.json` (`frontendDist: ../dist`,
  `beforeBuildCommand`, `bundle.active`).
- Kein bestehender Feature-Flag-Mechanismus.

## Stories (Zerlegung — Issue-Erstellung folgt)

- **S1 — Spike: Architektur-Review Kapselung & Tree-Shaking-Fähigkeit.** Prüft, ob
  chronicle/cards/plugins-UI/rules an Import-Grenzen sauber isoliert sind (konditionale/
  dynamische Imports möglich, sodass Rollup sie aus dem Release-Bundle tree-shaked). Klärt die
  **cards-Embed-Abhängigkeit** (`CardPreview` in maps/entities?) und ob ein **Entkapselungs-
  Refactor VOR S2/S3** nötig ist. Bestätigt, dass das **Plugin-Substrat** von der Plugin-UI
  trennbar ist. Output: Report + Refactor-Bedarf (ggf. eigene Story). `type: spike`, minimal/
  kein Prod-Code. **Gate für S2/S3.**
- **S2 — Feature-Config-Mechanismus (`features.json` + Vite-Build-Gating).** Flache
  `features.json` im Repo-Root (`"cards": false`, laien-editierbar); `vite.config.ts` liest sie
  zur Build-Zeit → `define`-Compile-Konstanten; zentraler `feature(id)`-Guard + konditionale/
  dynamische Imports an den Mount-/`AREAS`-Stellen. **Dev (`import.meta.env.DEV`) = alle
  Features**, Release (`vite build`) = config-gated, ohne Extra-Flag. AC inkl. **Bundle-
  Nachweis** (Grep in `dist`, dass unreleased Code fehlt). Keine verstreuten Flags.
- **S3 — 0.1-Cut anwenden.** chronicle/cards/plugins-UI/rules in `features.json` auf
  `released:false`; Mounts/Imports gaten; **Substrat** (`plugin-entity-service` /
  `-declaration-registry` / `-schema-loader` / `entity-type-schemas`) bleibt verdrahtet für
  Kern-Typen. Edit-`session`-Pointer entfernen. Bundle-Verifikation. **Play-Seite erst nach
  S7.** Depends S1+S2.
- **S4 — Nutzerdaten → `Dokumente\WorldsAndBeyond\` + First-Run-Seeding.** `projects/` `plugins/`
  `themes/` bei First-Run anlegen; `theme-tester.html` nach `themes/` seeden; ggf. Migration
  bestehender Ablage. Nutzt vorhandene `fs:allow-document-*`-Capabilities. `type: story`
  (Persistence/Boot).
- **S5 — User-How-To schreiben (2 Kapitel „Für DMs" / „Für Player").** Kurzes, je aktives
  Feature erklärendes How-To. Liefert die Resource für S6. `type: docs`.
- **S6 — Packaging & Cleanliness-Verifikation.** How-To + theme-tester als Release-Assets
  (`bundle.resources` bzw. First-Run-Seed aus S4); Nachweis, dass der **Install-Ordner clean**
  ist (kein `src/tests/docs/planning`-Ballast) und der NSIS-Installer das erwartete Artefakt
  erzeugt. CI-Pfad (`release_on_version.yml`) bleibt; nur prüfen, dass `vite build`=Release
  greift. Depends S4+S5.
- **S7 — lobby/Play-Cockpit-Refinement (separate Story, D8).** Scope der Play-Cockpit-Tabs
  (Map/Kampflog/Spotlight/Free-Browse/Split) für 0.1 klären. **Prerequisite fürs Play-seitige
  Gating in S3.** Eigener Requirement-Pass.
- **S8 — Settings-Refinement / Cleanup (Edit + Play).** Beide Settings-Flächen (Edit =
  `project`-Bereich, Play = `play-settings`) auf Release-Qualität bringen (Layout/States/
  Primitives). Entspricht dem Pre-Release-Item **#6 „UX-Session Settings"** — läuft **VOR** dem
  Gating (Decision 1 im Pre-Release-Epic) und ist ein **Release-Quality-Gate**, kein Gating-
  Baustein. Nach AGENTS am ehesten **UI/UX-Sprint-Mode** (lightweight, additive Politur) statt
  formaler TDD-Story — beim Anlegen entscheiden. Konkreter Politur-Scope wird zu Beginn kurz
  festgelegt (eigener Mini-Requirement-Pass, analog S7).

## Story Tracking

| Story | Issue | Titel | Status |
|---|---|---|---|
| S1 | [#403](https://github.com/Djimon/WorldBrain/issues/403) | Spike: Kapselung & Tree-Shaking-Review | ready (Gate) |
| S2 | [#404](https://github.com/Djimon/WorldBrain/issues/404) | Feature-Config-Mechanismus (features.json + Vite) + chronicle/cards/plugins/rules/audio/graph gegatet | patch-verified |
| S2a | [#412](https://github.com/Djimon/WorldBrain/issues/412) | maps als ganzes Feature gaten (Folge zu S2) — **umgesetzt + tree-shaken** | patch-verified |
| S2b | [#413](https://github.com/Djimon/WorldBrain/issues/413) | session als Feature gaten — **Runtime-Hide-Ausnahme (D12)** | patch-verified |
| S3 | [#405](https://github.com/Djimon/WorldBrain/issues/405) | 0.1-Cut anwenden (chronicle/cards/plugins-UI/rules) | blocked (S1,S2; +S7 play) |
| S4 | [#406](https://github.com/Djimon/WorldBrain/issues/406) | Nutzerdaten → Documents + First-Run-Seeding | ready |
| S5 | [#407](https://github.com/Djimon/WorldBrain/issues/407) | User-How-To (DMs/Player) | ready |
| S6 | [#408](https://github.com/Djimon/WorldBrain/issues/408) | Packaging & Cleanliness-Verifikation | blocked (S4,S5) |
| S7 | [#409](https://github.com/Djimon/WorldBrain/issues/409) | lobby/Play-Cockpit-Refinement | needs-design (prereq Play) |
| S8 | [#410](https://github.com/Djimon/WorldBrain/issues/410) | Settings-Refinement (Edit+Play) = Pre-Release #6 | needs-design (Release-Gate) |

Milestone: **pre-release (#21)**. Reihenfolge: **S1 → (ggf. Refactor) → S2 → S3**; **S4·S5**
parallel; **S6** zuletzt; **S7** früh (blockt Play-Teil von S3). Gesamt-Reihenfolge im
Pre-Release: nach #6 Settings-UX (Decision 1 im Pre-Release-Epic).

## Abhängigkeiten

- S3 ⟵ S1, S2 (und für die Play-Seite ⟵ S7).
- S6 ⟵ S4 (theme-tester-Seed), S5 (How-To).
- Settings-Polish (#6) läuft VOR diesem Epic (Release-Gate).
- Plugin-Substrat bleibt — NICHT mit der Plugin-UI entfernen (S1 bestätigt Trennbarkeit).
