# EPIC: Player-Only Edition (Build-Edition-Achse)

> **Status: SPEC / needs-design.** Konzept aus der Feature-Config-Arbeit (#404 ff.) hervorgegangen.
> Milestone **post-release (#22)** — läuft NACH dem 0.1-Beta (pre-release, #21). Stories unten sind
> Vorschläge; ein Requirement-Pass (Gold-Standard nach AGENTS.md) schärft sie vor der Issue-Erstellung.

## Kontext (für Leser ohne Vorwissen)

Worlds and Beyond ist eine Tauri-v2-Desktop-App (Renderer = Vite/Rollup-Bundle). Sie hat **zwei
Laufzeit-Modi** in **einer** App-Shell (`src/ui/WorkspaceShell.tsx`): `edit` (Autoren-/DM-Workspace)
und `play` (Session-Cockpit), umgeschaltet über einen Header-Toggle (`mode`-State). Der Boot läuft über
`src/main.tsx` → `src/App.tsx` (Projekt öffnen → WorkspaceShell im Edit-Modus). `main.tsx` verzweigt
heute bereits beim Boot per URL-Hash in ein **separates Fenster** (das Audio-Soundboard,
`#/audio-soundboard` → `AudioSoundboardWindow`) statt in `App` — dasselbe Boot-Verzweigungsmuster, das
diese Edition braucht.

Seit **#404** existiert ein Feature-Config-Mechanismus: flache `features.json` (Repo-Root) →
`__FEATURE_<ID>__`-Compile-Konstanten via `scripts/feature-defines.mjs` (vite + vitest) →
`src/config/features.ts` (`feature(id)`), Tree-Shaking über lazy dynamic imports mit direkt-inline
Konstante; Bundle-Nachweis `scripts/verify-feature-cut.mjs`. **Das gated einzelne FEATURES, nicht MODI.**

## Goal

Ein **Player-only-Build**: eine schlanke Edition, die **ausschließlich** dem Spielen/Beitreten dient —
kein Autoren-/Edit-Workspace, keine Autoren-DB, kein Plugin-Substrat. Der Nutzer bootet direkt in den
Join/Lobby-Flow und das Play-Cockpit. Die Autoren-Seite ist im Player-Build **echt entfernt**
(tree-geshaked), sodass der ausgelieferte Client klein ist. Die bestehende Voll-Edition bleibt unberührt.

## Warum die aktuellen Feature-Flags allein NICHT reichen

- `features.json` gated **Features**, nicht den **Modus/Shell**. „Edit-Modus" ist kein Flag, sondern die
  Default-Shell (Epic-Entscheid D9 im Feature-Config-Epic: flach, kein per-Modus).
- Kern-Bereiche (entities/search/calendar/maps) sind in **beiden** Modi (`AREAS` + `PLAY_AREAS`) —
  einzeln abschaltbar brechen sie Play. Player-only ist ein **Shell-/Boot-Schnitt**, kein Feature-Cut.
- Der Boot startet immer im Edit-Workspace.

## Die entscheidende Architektur-Naht (macht es realistisch)

- **D30-Membran (M10):** der Player-Pfad ist bereits **DB-los** — `PlayerJoinView` + `PlayModeView`
  (player-role) + `play-client-store` rendern **ausschließlich** aus dem transport-gefütterten Store,
  ohne Datenbank-Zugriff. Der Player-Client ist damit konzeptionell schon ein weitgehend
  **eigenständiges, entkoppeltes Subsystem**.
- **Spiegelbild zu #413:** dort war „Play aus einer Edit-App schneiden" zu verwoben (Runtime-Hide-
  Ausnahme, D12). Andersrum — **Edit aus einer Play-App schneiden** — ist sauberer, weil der Player dank
  Membran ohnehin nicht am Autoren-Code/an der DB hängt. Alles hinter der DB-Grenze fällt weg.
- **Boot-Verzweigung existiert schon** (`main.tsx`, Soundboard-Fenster) — dasselbe Muster für einen
  Player-Boot.

## Mechanismus-Vorschlag (HOW — im Requirement-Pass verfeinern)

1. **Zweite Achse neben den Feature-Flags: eine `edition`-Kompilierkonstante** (`player` | `full`),
   NICHT in `features.json` (das ist Feature-granular), sondern eine eigene Build-Konstante über denselben
   define-Mechanismus (z. B. eine `edition`-Angabe, die `scripts/feature-defines.mjs` / eine
   Schwester-Datei zu `__EDITION__` auflöst). Dev-Default = `full`.
2. **Boot-Split:** in `edition=player` bootet `main.tsx`/`App.tsx` direkt in den Join/Lobby-Flow
   (`PlayerJoinView` → `PlayModeView` player-role), **ohne** Projekt-Bootstrap/Edit-Workspace.
3. **Edit-Shell kapseln & tree-shaken:** der Edit-Workspace (Autoren-`WorkspaceShell`-Teil, Entity-
   Editing, DB-Layer, Plugin-Substrat, Autoren-Services) wird so hinter die `edition`-Konstante gegatet,
   dass Rollup ihn im Player-Build droppt. Die DB-Membran ist die Schnittkante.
4. **Bundle-Nachweis** analog `verify-feature-cut.mjs`: im Player-Build fehlen Autoren-Chunks
   (Editor/Entity-Editing/Plugin-Substrat/DB-Layer) in `dist/`.

## Verhältnis zu den Feature-Flags

- Die `edition`-Achse ist **orthogonal** zu `features.json`. In einer Player-Edition ist `session`
  natürlich **an** (Kern-Zweck) — die #413-Runtime-Hide-Ausnahme stört hier NICHT.
- Feature-Flags könnten innerhalb einer Edition weiter greifen (z. B. Player-Edition ohne `audio`).
- Passt zum früheren Orchestrator-Wunsch „verschiedene Pakete schnüren".

## Stories (Zerlegung — Vorschlag, Requirement-Pass folgt)

- **PE-S1 — Spike: Edit/Play-Trennschärfe & DB-Membran-Audit.** Prüft, wie sauber der Player-Pfad
  (PlayerJoinView/PlayModeView-player/play-client-store) heute wirklich von Autoren-Code/DB getrennt ist;
  identifiziert alle Stellen, wo der Player-Pfad noch auf Edit-/DB-Code zugreift (Leaks über die Membran).
  Output: Report + Refactor-Bedarf. Gate für PE-S2/S3. `type: spike`.
- **PE-S2 — `edition`-Build-Achse + Boot-Split.** `__EDITION__`-Konstante (define, dev=`full`);
  `main.tsx`/`App.tsx` booten in `player` direkt in den Join/Lobby-Flow. Bundle-Nachweis-Gerüst.
- **PE-S3 — Edit-Shell kapseln & tree-shaken.** Autoren-Workspace/Entity-Editing/DB-Layer/Plugin-
  Substrat hinter `edition` gaten (lazy/konditional), sodass sie im Player-Build aus `dist/` fallen.
  Bundle-Nachweis: Player-Build ohne Autoren-Chunks. Depends PE-S1, PE-S2.
- **PE-S4 — Packaging der Player-Edition.** Eigenes Build-/CI-Ziel (schlanker Player-Installer) neben
  der Voll-Edition; Nutzerdaten/Themes-Ablage wie Voll-Edition, nur ohne `projects/`-Autoren-Teil.
  Depends PE-S3.

## Offene Fragen / Entscheidungen (Requirement-Pass)

1. Ist die `edition` eine reine Build-Konstante (zwei getrennte Installer) oder soll ein Installer beide
   Modi enthalten und beim Start wählen? (Für „echt entfernt/klein" → getrennte Builds.)
2. Braucht die Player-Edition eine minimale lokale Persistenz (z. B. gespeicherte Join-Codes/Identität)
   oder ist sie rein transport-/store-basiert?
3. Wie viel des Kalender-/Karten-Anzeige-Codes braucht der Player wirklich (read-only Anteile), und ist
   der sauber vom Autoren-Editing trennbar?
4. Namens-/Branding-Variante für die Player-Edition (Fenstertitel/Wordmark)?

## Anti-Patterns (verbatim, für die späteren Stories)

- „Centralize config; no scattered config." — die `edition`-Achse zentral, nicht verstreut.
- „Magic strings when constants/enums fit" — Edition als Union/Konstante.
- **Shim/Compat mit leerem Real-Pfad ist verboten** — der Player-Build darf keine Autoren-Stubs
  enthalten, die zur Laufzeit leer sind; entweder echt entfernt oder echt vorhanden.
- **Built-but-unmounted = Severe** — jede neue Player-Boot-Komponente über einen echten Pfad erreichbar.
- i18n: neue nutzer-sichtbare Strings via `t()` mit echtem en+de-Key (`docs/i18n-guide.md`).
- UI-Guide `docs/UIConsolidation/DEV-UI-GUIDE.md` bei UI-Berührung.

## Abhängigkeiten

- Baut auf dem Feature-Config-Mechanismus (#404) auf (gleicher define/Tree-Shaking-Ansatz).
- Berührt das M10-Multiplayer-Subsystem (in-progress) — PE-S1 klärt Reifegrad der Membran zuerst.
- Läuft **nach** pre-release (0.1). Milestone: **post-release (#22)**.
