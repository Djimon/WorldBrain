# EPIC: Pre-Release — Weg zum 0.1-Beta

## Kontext (für Leser ohne Vorwissen)

Worlds and Beyond ist eine **Tauri-v2-Desktop-App** (React + TypeScript, OS-WebView) zum Bauen und Bespielen von Pen-&-Paper-Rollenspielwelten, mit zwei sich ausschließenden Shell-Modi (**Bearbeiten/Edit** ⟷ **Spielen/Play**).

Dieses Epic ist **kein neues Feature**, sondern der **Sammel-Anker für die letzte Meile bis zur ersten veröffentlichten Beta (0.1)**: eine Handvoll Quickfixes, ein i18n-Durchlauf, das einmalige Grün-Ziehen der Test-Suite, das Härten des Release-Builds (Feature-Scope-Lock) und zwei UX-Durchläufe. Es bündelt die Stories im **GitHub-Milestone „pre-release" (#21)**.

**Explizit NICHT Teil dieses Release-Laufs: das Plugin-Substrat / M9-Overlay-Reifegrad-Thema** — ein eigenes, großes Thema, das später angegangen wird (siehe `planning/plugin-substrate-maturity-2026-08-31.md`).

## Goal

Ein **installierbares, aufgeräumtes 0.1-Beta** mit einem klar abgegrenzten, funktionierenden Feature-Satz, ohne halbfertige Features im Release-Build, mit konsistenter Lokalisierung (DE/EN) und grüner Test-Suite als verlässliches Regressions-Signal.

## Feature-Scope 0.1-Beta (aktiv im Release)

- **entities**, **search**, **maps**, **calendar**, **audio**, **graph**, **settings**
- **play-mode / Lobby** als Laufzeit-Container (Voraussetzung für #2 „Campaign→Lobby" und #5 „Play-Mode Live-UX"). Der Play-Modus bleibt im Release aktiv; nur der redundante Campaign-Roster im Edit-Modus fällt weg.

Alles außerhalb dieser Liste ist im Release-Build ein Kandidat für **echtes Entfernen** (nicht nur Mount ausblenden) — Detail-Entscheidung in Story #4.

## Decisions

1. **Reihenfolge (vom Orchestrator bestätigt):**
   **(a) Quickfixes + Repo-Sanierung zuerst** → **(b) #6 Settings-UX** → **(c) #4 Feature-Scope-Lock / Release-Build-Config** → **(d) evtl. Bugfixing** → **(e) #7 0.1-Beta-Release**.
   Begründung für „Quickfixes/Repo zuerst": #4 (Scope-Lock) wird ein Umbau — vorher soll das Repo sauber sein (grüne Tests, gefixte Quickfixes, konsistente i18n). **#6 (Settings-UX) kommt vor #4.**
   *(Platzierung von #5 „Play-Mode Live-UX (2 Rechner/2 Netze)" nicht final festgelegt — sinnvoll als Release-Readiness-Validierung nahe #7; offen bis Orchestrator-Bestätigung.)*

2. **Fenstertitel (#0) = Header-Wortmarke.** Der OS-Fenstertitel zeigt **Platform + Mode** exakt wie der In-App-Header (`Worlds and Beyond – RealmForge` im Edit, `Worlds and Beyond – Adventure Nexus` im Play). „Mode" ist die **modus-gebundene Marke** (RealmForge/Adventure Nexus), **kein** umschaltbarer Klartext; „Bearbeiten/Spielen" sind nur Button-Labels. Gehört fachlich zum Epic `identity-naming-mode-theming.md` (Decision 1 „…erscheint in Fenstertitel", Decision 2 „Modus→Marke").

3. **Eine Campaign = eine Gruppe (#2).** Es gibt **kein** Roster-/Gruppen-Konzept. Das „Campaign-Mitglieder"-Panel im Edit-Modus (`CampaignRosterPanel`) wird **ersatzlos gelöscht** (nicht nur ausgeblendet). Einladungscode/verbundene Spieler leben in der Play-Lobby (`LobbyPanel`), die bleibt. **Kein** Gruppen-/Roster-UI woanders neu aufbauen.

4. **Repo-Sanierung fasst offene TDD-Tests nicht an (Test-Triage / #400).** Fails für **noch ungebaute Features** bleiben rot und werden nicht „grün gemacht": M17 `m17-s01…s05` (#381–#385), M10 `m10-dbless-join-handshake` (#387). Grundlage ist `planning/test-triage-2026-08-31.md`. Es gilt die AGENTS **Test Conflict Stop Rule** und `ANTI_PATTERNS.md` (u. a. AP-005 `require`/ESM, AP-008 RTL-Anchoring) — nie Produktionscode verbiegen, nie Tests grün-frisieren.

5. **Release-Build entfernt In-Dev-Features + Ballast (#4).** Nur fertige Features werden im Release konfiguriert; der Dev-Build hat immer alle. „So gut es geht ganz entfernen, nicht nur Mount unsichtbar." Ebenso fliegen Tests/Docs/Planning/.md aus dem Release-Build (Ausnahme: `theme-tester.html` → ggf. nach `/themes/` NACH install-exe). Architektur-Review auf ausreichende Kapselung; ggf. Refactor. **Detail-Spec folgt als eigene(s) Epic/Story vor Umsetzung.**

## Out of Scope

- **Plugin-Substrat / M9-Overlay-Reifegrad** (eigenes großes Thema, später; `planning/plugin-substrate-maturity-2026-08-31.md`).
- Offene M17-Stories (#381–#385) und M10-WIP (#387) — deren TDD-Tests bleiben rot (Decision 4).
- Feature-Erweiterungen jenseits des oben definierten 0.1-Feature-Satzes.

## Code-Anker (Ist-Zustand, Stand der Recherche)

- **Shell-Header / Modus / Fenstertitel:** `src/ui/WorkspaceShell.tsx` (Wortmarke `:1167`, OS-Titel-Effekt `:1061-1069`, Modus-State `:130` + `AppModeContext`). Statischer Titel: `index.html:6`, `src-tauri/tauri.conf.json:15`.
- **Campaign-Bereich (zu entfernen):** `AREAS` `:104`, Gate `:934-936`, `case 'campaigns'` `:595-601`, Komponente `src/ui/CampaignRosterPanel.tsx`. Play-Lobby (bleibt): `src/ui/PlayModeView.tsx:169-170` → `src/ui/LobbyPanel.tsx`.
- **Grid-Controls-Panel:** `src/ui/MapGrid.tsx:305` (`.grid-controls-panel`), CSS `src/styles/components/maps.css:983`.
- **i18n:** `src/i18n.ts` (Namespaces `common,nav,entity,map,session`; **`multiplayer` fehlt**), Locales `src/locales/{en,de}/*.json`, `useTranslation`-Hook.
- **UI-Regeln:** `docs/UIConsolidation/DEV-UI-GUIDE.md`, Primitives `src/ui/primitives.tsx`, Tokens `src/styles/tokens.css` (Gates: keine rohen Farben, keine statischen Inline-Styles).

## Stories / Story Tracking

| Todo | Issue | Titel | Status |
|---|---|---|---|
| #0 | [#401](https://github.com/Djimon/WorldBrain/issues/401) | OS-Fenstertitel: Platform + Mode (Header-Wortmarke) | ready |
| #1 | [#399](https://github.com/Djimon/WorldBrain/issues/399) | i18n-Sweep — hartkodierte Strings durch `t()` (DE/EN) | ready |
| #2 | [#397](https://github.com/Djimon/WorldBrain/issues/397) | Campaign-Bereich aus Edit-Modus entfernen (Lobby ersetzt) | ready |
| #3 | [#398](https://github.com/Djimon/WorldBrain/issues/398) | Grid-Controls-Panel scrollbar (kleine Monitore) | ready |
| Triage | [#400](https://github.com/Djimon/WorldBrain/issues/400) | Test-Suite grün ziehen (Cluster B/C/D) | ready |
| #6 | [#410](https://github.com/Djimon/WorldBrain/issues/410) (+Nachlese #428–#430) | UX-Session Settings | ✅ erledigt |
| #4 | [#403](https://github.com/Djimon/WorldBrain/issues/403)–#408, #412/#413 | Feature-Scope-Lock / Release-Build-Config | ✅ erledigt |
| #5 | — (kein Ticket) | Play-Mode Live-UX (2 Rechner/2 Netze) | **manueller Test des Orchestrators** nach Milestone-Abschluss |
| #7 | — (kein Ticket) | 0.1-Beta-Release | **kein Release-Ticket** — Orchestrator lädt das Release selbst hoch, wenn „so weit" |

**Play-Views-Datenquelle (S8 / [#427](https://github.com/Djimon/WorldBrain/issues/427), `needs-design`):** gehärtete Architektur-Entscheidung (2026-09-05) = **eine Datenquellen-Abstraktion** (Read-Interface, DM→DB-Impl / Spieler→Snapshot-Store-Impl), **kein per-View-Branch**; auch maps/combatlog werden migriert. Reihenfolge **#432 → #427**. Details im Ticket #427.

Milestone: **pre-release (#21)**.

## Abhängigkeiten

- #2 (Campaign→Lobby) vor #5 (Play-Mode Live-UX).
- #6/#1 vor #5 (Play-Session testet lokalisierte, aufgeräumte UI).
- #4 (Scope-Lock) nach der Repo-Sanierung (Quickfixes + grüne Tests), damit der Umbau auf sauberer Basis läuft.
- `identity-naming-mode-theming.md` (M17) — Heimat-Epic für #0/#401.
