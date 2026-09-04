# EPIC: Play-Mode — Lobby, Views & persistente Session-Leiste (Pre-Release #6-Folge)

Status: **Spec-ready** (Grill abgeschlossen 2026-09-02). Nächster Schritt: Issues.

## Kontext / Problem

`src/ui/PlayModeView.tsx` ist heute das **gesamte** Play-Cockpit in *einem* Screen. Für den DM
stapelt es: `LobbyPanel` (Invite + Roster) → `SessionTimeControl` → ein internes **Tab-Cockpit**
(Map / Kampflog / Spotlight / Free-Browse, Spieler zusätzlich „Bogen") → einen **Split-Toggle**
„Map ‖ Kampflog".

Konstruktionsfehler: das Cockpit **baut eine eigene Navigation (Tabs) nach**, obwohl die linke
Sidebar im Play-Mode ohnehin Bereiche hat. Dadurch existiert „Map" doppelt (Sidebar *und* Tab),
die Lobby wirkt mit dem ganzen Playmode vollgestopft, und „Split" wurde als Feature missverstanden.

## Leitentscheidung — Navigations-Modell A

**Alle Play-Inhalte sind Sidebar-Views. Keine internen Tabs. Kein Split.**
Das interne Tab-Cockpit + der Split-Toggle entfallen ersatzlos.

### Play-Sidebar für 0.1
`entities · search · maps · calendar · lobby · combatlog · spotlight(Stub) · settings`

- **entities / search / calendar** = dieselben Views wie im Edit-Mode, rollen-gefiltert (s. u.).
- **maps** = zeigt im Play-Mode die **Präsentations-Map** (Tokens/Fog, `PlayCockpitMap`). Kein
  eigener „Map"-Tab mehr.
- **lobby** = eigene View (ersetzt das alte „session"-Sammelbecken).
- **combatlog** = **neue** eigene View (DM + Spieler), inkl. Würfel-Widget (`DiceRollerWidget`).
  **Fundament, kein Cut-Feature:** der Combat-**Log** ist ein *dummer* gemeinsamer Log, in den
  künftig alle Systeme schreiben; das Würfeln ist das einfachste Wurf-System und der erste
  Service, der in diesen Log schreibt. Beide sind **immer da**. Das ist **nicht** die künftige
  echte VTT-Regel-Engine (`combat`: Attack-Hooks, automatische Verrechnung der Charakterbogen-
  Werte etc.) — die kommt später als eigenes, gate-bares Feature `combat`. Siehe Entscheidung 4.
- **spotlight** = **„Coming soon"-Stub-View** (leerer Sidebar-Eintrag mit „Bald"-Hinweis;
  Whiteboard-Feature kommt nach 0.1).
- **settings** = `PlaySettingsPanel` (bestehend).
- **Bogen (Charakterbogen, Spieler)** = **nach 0.1** (nicht im 0.1-Sidebar-Set).

## Rollen-Sichtbarkeit (Play-Mode)

| View       | DM                                   | Spieler                                        |
|------------|--------------------------------------|------------------------------------------------|
| entities   | alles (Host-DB)                      | nur DM-Freigegebenes (Transport-Store)         |
| search     | alles                                | über Freigegebenes                             |
| maps       | volle Kontrolle + „Präsentieren"     | die präsentierte Map (unverriegelt, s. Fokus)  |
| calendar   | ja                                   | ja (lesend)                                    |
| lobby      | **voll** (Invite/Link/Roster/Kick/Gruppen/Start-Stop) | **reduziert** (Roster + Session-Status + eigener Verbindungsstatus; kein Invite/Kick/Gruppen) |
| combatlog  | posten + würfeln, sieht alles        | sieht sichtbarkeits-gefiltert, würfelt         |
| spotlight  | Stub                                 | Stub                                           |
| settings   | ja                                   | ja                                             |

## Kern-Prinzipien & -Mechaniken

### 1. Free-Browse (Prinzip, keine View)
Der Spieler ist **nie** an eine vom DM geteilte/fokussierte Ansicht *gelockt*. Er kann jederzeit
selbst in jede andere Sidebar-View wechseln und nachschauen. „Free-Browse" ist damit kein
Menüpunkt, sondern die Garantie freier Navigation.

### 2. Fokus / Präsentieren — **opt-in „Drop-in"**
Wenn der DM etwas präsentiert/fokussiert, wechselt die Spieler-Ansicht **nie** automatisch.
Stattdessen erscheint ein **schwebendes „Drop-in"** (unten rechts), das **layer-über allen Views
schwebt** und **bleibt, egal in welche View der Spieler wechselt** (verschwindet erst, wenn er
manuell genau zum Fokus navigiert). **Klick auf den Kasten → springt zur DM-Fokus-Ansicht.** Der
Kasten ist **leicht animiert** (dezent „nervend") als „hier passiert was!"-Reminder. View-
unabhängig → passt zum free-browse. Text: **„DM zeigt gerade: X"**.

**Umgesetzt als NEUES Design-System-Primitive** (`FloatingCard` in `src/ui/primitives.tsx`):
fixed, ecken-verankert (unten rechts), z-Index über allen Views, optionaler dezenter Puls. Bewusst
ins Design-System, weil fast alle bestehenden Primitives sich *einer* View unterordnen — dies ist
das erste, das **view-übergreifend über allem schwebt** (künftig auch für Broadcasts/Notifications).
- **0.1:** präsentierbar ist die **Map**. (Technisch existiert `pushPresentedMapSnapshot` /
  presented-map-push bereits.)
- **später:** Spotlight/Whiteboard, ggf. einzelne Entities.

### 3. Session starten/stoppen (DM, in der Lobby) = **Verbindung**
- **Start** = Signaling/Transport an, Raum offen, Spieler können beitreten + syncen. Der
  **Invite-Code ist erst nach Start gültig**.
- **Stop** = Raum zu, alle getrennt, kein Sync mehr.
- (Heute implizit an Play-Mode-Eintritt gekoppelt; wird zum **expliziten** Lobby-Control.)

### 4. Persistente Session-Leiste (immer sichtbar, view-unabhängig)
Trägt die **Campaign-Zeit**: **Datum** Jahr / Monat / Tag (über `formatCalendarDate`) **+
Tageszeit** (Session-State, abstrakt oder echte Uhr — s. Zeit-Modell). DM steuert (Advance
+Tag/Woche/Jahr, absolut setzen — die **bestehende `SessionTimeControl`-Logik**, nur umgezogen —
plus Tageszeit setzen/weiterschalten); alle sehen Datum + Tageszeit.
- Der **Fokus-Hinweis liegt NICHT in dieser Leiste** — er ist ein eigenes schwebendes Drop-in
  (unten rechts, über allen Views; s. Fokus/Präsentieren).

## Zeit-Modell — Tageszeit lebt in der Session (voll im Epic-Scope, 0.1)

Architektur-Regel (User): Der **Kalender bleibt tag-granular** (`CalendarDate = {year, month,
day}`) und schlank — er ist **entity-verknüpft**, jede Uhrzeit dort würde das Modell aufblähen.
**Tageszeit/Uhrzeit ist ausschließlich ein Campaign-/Session-Zustand**, unabhängig vom
Kalender-Schema.

Damit ist die Tageszeit **kein Kalender-Umbau** mehr → sie gehört **vollständig in dieses Epic
(0.1)**, nicht nach hinten geschoben:
Der DM wählt pro Campaign den **Zeit-Modus** (zwei Achsen):
- **realtime (Default)** — 24h-Uhr, umschaltbar auf 12h am/pm.
- **abstract** — **5 vordefinierte Phasen** (Morgen · Mittag · Nachmittag · Abend · Nacht), vom DM
  **editier-/erweiterbar** (umbenennen, hinzufügen, entfernen).

- Der DM **setzt / schaltet** die Tageszeit weiter (analog zu Advance / Set-absolute bei den Tagen).
- Die **persistente Leiste** zeigt **Datum** (Kalender) **+ Tageszeit** (Session, je nach Modus).
- Alles **Session-State**, kein Kalender-Schema-Change.

## Was bleibt / was fällt (Code-Inventar)

**Löschen / entfernen:**
- `SplitView.tsx` + der Split-Toggle in `PlayModeView` (missverstandenes Feature).
- Das interne Tab-Cockpit in `PlayModeView` (Tab-State, `Tabs`, `CockpitTab`, redundanter „Map"-Tab).

**Behalten / umziehen (NICHT löschen):**
- `SessionTimeControl` — Logik intakt, wandert in die **persistente Leiste**.
- `LobbyPanel` — Kern (Invite/Link/Roster/Kick/Gruppen) bleibt; wird zur **Lobby-View**, bekommt
  den **Start/Stop**-Control; **reduzierte** Spieler-Variante ergänzen.
- `PlayCockpitMap` — wird der Inhalt der **maps**-View im Play-Mode.
- `combat-log-service` + `DiceRollerWidget` + der Kampflog-Pane → **combatlog**-View.
- presented-map-push / `pushPresentedMapSnapshot` → speist den **Fokus-Hinweis** (opt-in).

## Umsetzungs-Kontext (Stand: #404 ist GEMERGED)

Feature-Config (#404) ist **gelandet** (`features.json` + `src/config/features.ts`,
`feature(id)`-Gating, lazy Feature-Imports in `WorkspaceShell`). Diese Umsetzung baut **darauf
auf** — keine Parallel-Koordination nötig (frühere Annahme war veraltet).

Heutige Struktur, die dieses Epic umbaut:
- `PLAY_AREAS = ['entities','search','maps','calendar','session','play-settings']` — die **eine**
  `'session'`-Area rendert aktuell das komplette `PlayModeView`
  (`inPlayCockpit = mode==='play' && activeArea==='session'`). Genau diese Sammel-Area wird
  **aufgeteilt**.
- `feature('session')` gatet den ganzen Play-Mode (Toggle + Area) — bleibt.
- Neue Play-Views = neue `Area`-IDs + Render-Branches. Ziel:
  `PLAY_AREAS = ['entities','search','maps','calendar','lobby','combatlog','spotlight','play-settings']`
  (statt der Sammel-`'session'`).
- `PlayModeView` wird **zerlegt**: interne Tabs + `SplitView` raus; Inhalte wandern in die
  jeweiligen Area-Branches — lobby → `LobbyPanel` + Start/Stop, combatlog → Kampflog + Dice,
  spotlight → Stub, maps → `PlayCockpitMap`.
- Persistente Session-Leiste = im Play-Shell (`WorkspaceShell`), view-unabhängig.
- **Eigene `features.json`-Flags** für `combatlog` + `spotlight` (in `FEATURE_IDS`), 0.1 beide
  `true` — konsistent mit #404. **Aber:** nur `spotlight` ist ein echtes künftiges Cut-Feature.
  `combatlog` (Log + einfaches Würfeln) ist **Fundament** und praktisch immer an — der Flag
  existiert nur für Config-Konsistenz; der Host-Combat-Sync ist bewusst **ungegatet** (immer
  verdrahtet). Das eigentliche gate-bare Kampf-Feature ist die spätere VTT-Engine `combat`
  (eigener Flag), **nicht** `combatlog`. Siehe Entscheidung 4.

## Entscheidungen geschlossen (Grill abgeschlossen 2026-09-02)
1. **Tageszeit:** zwei Modi — *realtime* (Default 24h, umschaltbar 12h am/pm) · *abstract*
   (5 editier-/erweiterbare Phasen). Reiner Session-State.
2. **Fokus-Hinweis:** schwebendes „Drop-in" unten rechts, über allen Views, leicht animiert,
   Klick → Fokus. NICHT in der Leiste.
3. **Spieler-Lobby:** Roster + Session-Status + eigener Verbindungsstatus.
4. **Feature-Flags:** eigene `combatlog`- + `spotlight`-Flags (0.1 beide an). **Klarstellung
   (nach #422):** `combatlog` = Fundament (dummer Log, in den alle Systeme schreiben, + einfaches
   Würfeln als erster Schreiber) → immer da, Host-Sync ungegatet; der Name bleibt. Die künftige
   echte Kampf-**Engine** (Attack-Hooks, Auto-Verrechnung Charakterbogen, VTT-Regeln) wird ein
   **separates** Feature `combat` — das ist das eigentliche Cut-/Gate-Feature, verwechsle es
   nicht mit `combatlog`.
5. **Sidebar-Reihenfolge/-Icons** (trivial änderbar): entities 🗂 · search 🔍 · maps 🗺 ·
   calendar 📅 · **lobby 👥** · **combatlog ⚔️** · **spotlight 🔦** · settings ⚙.

## Story-Split (→ GitHub Issues, Milestone `pre-release` #21)

Anker: **#409** („lobby/Play-Cockpit-Refinement", `needs-design`) ist das Refinement-Ticket für
dieses Thema — dieses Epic ist dessen Design-Vorlage. #409 wird auf „Design erledigt" aktualisiert
und in folgende Stories gesplittet. Abhängigkeit: **S1 zuerst** (schafft die Mount-Punkte).

**Angelegt (Milestone `pre-release` #21):** S1 **#420** · S2 **#421** · S3 **#422** · S4 **#423** ·
S5 **#424** · S6 **#425** · S7 **#426** · **S8 #427** (Datenquellen-Membran) · **S9 #432**
(WorkspaceShell-Extraktion). Status: S1 (#420) + S5 (#424) `ready`; S2/S3/S4/S6/S7 `blocked` bis
S1 steht (S6 zusätzlich hinter S5); S9 (#432) `blocked` hinter S1; S8 (#427) `needs-design`,
hängt an S1. **Reihenfolge der Struktur-/Daten-Kette: S1 → S9 → S8.**

- **S1 — Play-Navigation: Sammel-`session`-Area → einzelne Play-Sidebar-Views** (`WorkspaceShell`).
  `PLAY_AREAS` → `entities·search·maps·calendar·lobby·combatlog·spotlight·play-settings`;
  `PlayModeView`-Tabs + `SplitView` raus (`SplitView.tsx` löschen); `combatlog`+`spotlight` in
  `features.json`/`FEATURE_IDS` (0.1 `true`). `type: story · area: session-mode · area: ui-integration`.
- **S2 — Lobby-View** (adapt `LobbyPanel`): DM voll + **Session Start/Stop = Verbindung** (Signaling
  an/aus, Invite erst nach Start gültig); **reduzierte Spieler-Variante** (Roster + Session-Status +
  eigener Verbindungsstatus). `area: session-mode · area: multiplayer`.
- **S3 — Combatlog-View** (adapt Kampflog-Pane + `DiceRollerWidget`) — **#422, erledigt/gemergt**:
  DM postet+würfelt/sieht alles (Host-DB, inkl. `dm_only`), Spieler sichtbarkeits-gefiltert aus dem
  Transport-`store` (D30) + würfelt via `roll_dice`-Intent an den Host (host-autoritativ, leak-sicher:
  nur `all` wird broadcastet, `dm_only`/`private` nie). Die **View** ist über `visibleAreas`/
  `feature('combatlog')` erreichbar (0.1 an); **Log + Würfeln selbst sind Fundament** und der
  Host-Combat-Sync ist **ungegatet** (immer verdrahtet) — s. Entscheidung 4 (`combatlog` ≠ künftige
  `combat`-Engine). `area: session-mode`.
- **S4 — Spotlight Stub-View**: „Bald"-Platzhalter (Muster wie SettingsPanel-soon-Stub); hinter
  `feature('spotlight')`. `area: session-mode · area: ui`.
- **S5 — Zeit-Modell (Session-State)**: `realtime` (24h Default, 12h am/pm umschaltbar) · `abstract`
  (5 editier-/erweiterbare Phasen); DM setzt/schaltet; **pro Campaign persistiert**. Logik/Persistenz.
  `area: session-mode`.
- **S6 — Persistente Session-Leiste**: view-unabhängiger Streifen (Datum + Tageszeit); trägt die
  **umgezogene `SessionTimeControl`** + Tageszeit-Setter. Hängt an **S1** (Mount) + **S5**.
  `area: session-mode · area: ui`.
- **S7 — Fokus-Drop-in + „Map präsentieren"**: **neues Primitive `FloatingCard`** (fixed,
  ecken-verankert, z-über-allem, optionaler Puls) in `src/ui/primitives.tsx` + der Fokus-Drop-in
  nutzt es (opt-in, Klick → Fokus). DM-„Präsentieren"-Aktion in der Maps-View speist ihn
  (`pushPresentedMapSnapshot`). Hängt an **S1**. `area: session-mode · area: multiplayer · area: ui`.
- **S8 — Datenquellen-Membran (DB-los für Spieler)** — **#427**, `needs-design`, **pre-release**.
  S1 löst das Cockpit **strukturell** auf und bewahrt den Client-Store; **S8 stellt die
  wiederverwendeten Play-Views** (entities/search/maps/calendar via `renderArea()`) **von `database`
  auf die DB-lose Datenquelle** (Client-Store statt Host-DB) um — via Read-Interface (list/get) mit
  DB- und Client-Store-Impl, kein `if(player)` pro View. **Warum 0.1:** 0.1 hat echten
  Remote-Multiplayer — ein beitretender Spieler liest sonst live die Host-DB (Membran-Bruch im
  Release), nicht erst bei #414. Hängt an **S1** (S1 zuerst), speist #414. Groß/übergreifend → vor
  Umsetzung in kleinere pre-release-Stories zu zerlegen. `type: story · area: core · area: multiplayer · area: session-mode`.
- **S9 — WorkspaceShell-Extraktion (`usePlaySession`)** — **#432**, `blocked` (hinter S1), **pre-release**.
  `WorkspaceShell.tsx` ist auf ~1096 Zeilen / 34 State-Hooks / 13 Effekte gewachsen. **Kein** binärer
  edit/play-Shell-Split (dupliziert `renderArea()` + arbeitet gegen #427/D30) — stattdessen die
  ~30% **Play-Session-Orchestrierung** (sessionRole/activeSessionId/playerStore/Transport/Rolle +
  Host-/playerStore-Effekt + `enterPlay`/`exitPlay`/`pickRole`) in einen `usePlaySession()`-Hook +
  `<RoleSelectPanel>`/`<PlaySurface>`; **eine** Shell behält Chrome + `renderArea()`. **Läuft nach S1,
  vor S8:** gibt #427 eine saubere Naht (Hook besitzt playerStore/Transport) und de-riskt dessen
  `needs-design`. Nach S1: kurzer Schnittstellen-Design-Pass über die State-Atome, dann TDD-fähig.
  `type: chore · area: core · area: session-mode · area: ui-integration`.

## Nächster Schritt
Story-Split gegenlesen → Issues anlegen (jede cold-reader-self-contained, Epic-Entscheidungen
verbatim in die AC, Mount-Punkt benannt, aus `primitives.tsx` gebaut) → #409 als Design-Anker
aktualisieren. Umsetzung baut direkt auf der gemergten #404-Feature-Config auf.
