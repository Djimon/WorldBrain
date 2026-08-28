# EPIC-016: Multiplayer & Player Identity

## Goal

Spieler treten von **eigenen Geräten** (LAN oder Internet, via WebRTC) einer vom DM gehosteten
**Campaign** bei, erstellen einen Charakter auf Basis des Regelwerks und sehen ausschließlich die
Inhalte, die der DM gezielt mit ihnen (oder ihrer Gruppe) geteilt hat. Sichtbarkeit wird von binär
(`public/gm_only/player_known/hidden_until_condition`) auf **pro Spieler / pro Gruppe** verfeinert.

Grundlage: Handover `docs/handover-player-identity.md` (2026-06-30).

## Aktueller Stand (kanonisch — Stand 2026-08)

> **Diese Sektion ist die Wahrheit.** Wo irgendetwas weiter unten (Decisions, Stories) damit kollidiert, **gewinnt diese Sektion**. Die Detail-Decisions darunter sind die Herleitung/Historie; überholte sind als ⛔ markiert bzw. im Archiv am Ende.

**Was wir bauen:** Ein DM hostet eine **Campaign**; Mitspieler treten von **eigenen Geräten** (LAN oder übers Internet) bei und sehen nur, was der DM mit ihnen/ihrer Gruppe geteilt hat.

1. **Transport = WebRTC-DataChannel** (`src/services/webrtc-transport.ts` hinter `session-transport.ts`). **Es gibt KEINEN HTTP/WS-Server** (kein Rust-Server, keine Server-Deps). Lokal = Loopback/Same-Machine-Peer, remote = STUN für NAT-Traversal. Kein TURN/Relay, kein gehosteter Signaling-Server.
2. **Beitritt = Campaign-scoped Invite-Link/Code.** Der DM erzeugt in einer Campaign **einen** Einladungslink/-Code. Ein zweites Gerät klickt **„Campaign beitreten"**, fügt Link/Code ein → **ist automatisch Mitglied** (kein Approve, kein Antwort-Code). Öffentlich gemachter Link = Problem des DMs.
3. **Modus-Trennung Roster/Mitglieder (D31):** Roster, Mitglieder und **Gruppen-Zuordnung** leben im **Play-/Live-Modus** (Lobby, S06) — dort existieren Mitglieder (via `joinWithCode`). Der **Edit-Modus** hat nur ein schlankes **Campaign-Verwaltungs-Panel** (S24): CRUD + persistenter Invite-Code + optional Gruppen-**Namen** definieren. **Zuordnung erst live.**
4. **Eine App, zwei Modi** (D25): globaler Top-Bar-Toggle **Bearbeiten ⟷ Spielen**. Bearbeiten = voller Autor-Workspace (Welt-Basis). Spielen = Session-Sicht mit **festem Menü-Subset** (`entities/search/maps/calendar/session`); Eintritt wählt **Campaign + Rolle (DM/Player)**. Player = read-only (S23).
5. **GM-Self-Join** (D26): DM kann in der eigenen App als Player beitreten (loopback). Kein zweites Gerät/Build nötig.
6. **3-Schichten-Datenmodell** (D23): **Welt** (Basis) → **Campaign** (Klammer pro Gruppe: Overrides/Events/Roster/Visibility/Weltzeit) → **Session** (ein Termin = Notiz-/Log-Layer). Roster/Invite/Visibility hängen an der **Campaign**, nicht am Termin (S20).
7. **Sichtbarkeit** default alles `gm_only`; DM gibt gezielt pro Spieler/Gruppe frei (Decisions 5–8, S07/S09). Server- bzw. host-seitig durchgesetzt.
8. **Player-Auslieferung = App-Modus** (derselbe Build, kein zweiter .exe). **Browser-Join verworfen/deferred** (bräuchte einen Server, den es nicht gibt). Ein Remote-Spieler nutzt **denselben Build** (Toggle → Spielen → Rolle Player → Einladungslink). Die verfrühte `#/player`-Separate-App-Kette (PlayerClientApp/PlayerProjectDashboard/PlayerScreen) wird **entfernt** (#348) — das D10-Konzept „gespeicherte Host-Referenz" bleibt für die spätere echte Player-App erhalten.
9. **Host↔Client-Membran (D29) — die tragende Play-Modus-Architektur.** Der Play-Modus-**Client ist DB-los**: er rendert **nur**, was der **Host** ihm host-seitig gefiltert über den Transport pusht (Initial-Snapshot + Live-Deltas), **nie** aus einer lokalen DB (`database`/`useDatabase`). Die Membran gilt **hart auch im selben Prozess**: GM-Self-Join geht über **Loopback-Transport**, nicht per DB-Shortcut — so testet jedes Hosten den echten Client-Pfad mit. **Absicherung:** Guard „Client-Komponenten haben kein `database`" + Test „`gm_only` überquert die Membran nie". Der Transport wird **vorgezogen**; bis er verdrahtet ist, ist „Play-Modus" ausdrücklich nur **lokale DM-Vorschau**, kein Multiplayer.

**Verworfen:** Stufe-1 (mehrere Fenster auf der GM-Maschine — Geheimnis-Leak). Eingebetteter HTTP/WS-LAN-Server (nie gebaut, durch WebRTC ersetzt). Browser-Join (siehe 8). TURN-Relay + gehosteter Signaling-Server.

**Offener technischer Punkt (`needs-design`, S11/S12):** WebRTC braucht einen Signaling-Austausch, damit „Link/Code einfügen → drin" auch remote ohne manuelles Offer/Answer-Copy-Paste funktioniert. Wie dieser Austausch ohne gehosteten Server läuft (z.B. Link trägt Rendezvous-Info), ist die eigentliche offene Ingenieursfrage — gehört in die Transport-Story, nicht in die Produkt-Spec.

**Research:** `planning/research/multiplayer-internet-hosting.md` (STUN gratis, coturn nur Minderheiten-Fallback, EOS per ToS raus).

## Decisions

1. **Transport abstrahiert:** ⛔ **Teilweise überholt (siehe „Aktueller Stand"):** Das Transport-**Interface** gilt weiter (`session-transport.ts`). Die konkrete Ausprägung ist aber **WebRTC-DataChannel**, **kein** eingebetteter HTTP/WS-Server. Lebenszyklus an die gehostete Campaign gekoppelt.
2. **Session als einziger Multiplayer-Anker:** Das Multi-Player-Konstrukt existiert nur innerhalb einer Session. DM erstellt die Session (→ M8-S01 #152). Session erhält GUID + Hash + generierten Einladungscode.
3. **Spieler-Identität ist session-scoped, kein globaler Account:** Ein "Player" ist eine Mitgliedschaft (`session_id + player_id + token`). Der globale Spieler-Name bleibt Freitext (#160) — echte Identität entsteht erst beim Session-Join.
4. **Join-Flow (⚠️ überschrieben durch D24 — Auto-Join):** ~~DM erstellt Session → Einladungscode → Spieler gibt Code ein → `pending` → DM bestätigt (`approved`) → …~~ **Neu (D24):** DM erstellt Session → **einen** Einladungscode/-Link → Spieler gibt Code ein → **sofort aktives Mitglied** (kein Approve-Gate) → Charaktererstellung (→ M9-S03 #166) → sieht freigegebene Inhalte. Einziger nachträglicher Gate: **DM-Kick**.
5. **Default-Sichtbarkeit in einer Session: alles `gm_only`.** Der Spieler sieht nach dem Join zunächst nichts außer dem, was der DM explizit freigibt. Freigabe (Lore-Texte, Bilder/Concept-Art) läuft über das bestehende Visibility-System.
6. **Per-Spieler/Gruppen-Visibility ist additiv, nicht ersetzend:** Die 4 bestehenden Scopes (#53, #81) bleiben. `player_known` wird um eine Targeting-Ebene verfeinert: an welche Spieler / welche Gruppen. Neue Tabelle `session_visibility_overrides`, keine Erweiterung von `campaign_entity_overrides`.
7. **Abgrenzung zu Cross-Session World State (#156 / M8-S04):** Getrenntes Konzept. Per-Spieler-Visibility = *wer sieht was in einer laufenden Session*. Cross-Session World State = *was wird über Weltzeit in die globale Lore zurückgeschrieben* (DM-gesteuerter Promote-Schritt). Kein gemeinsames Datenmodell, aber kein Widerspruch: Visibility-Overrides sind session-scoped, World-State-Promotes sind global/weltzeit-scoped.
8. **Sicherheit ist Kernanforderung, kein Nebenaspekt:** Das gesamte Feature existiert, um Geheimnis-Leaks zu verhindern. Server-seitige Durchsetzung (`gm_only` by default), token-basierte Auth, keine Auslieferung nicht-freigegebener Inhalte an den Client.

## Detail-Spec (Grill-Session 2026-08) — Decisions 9–22

Vollständige Durchspecc-Session (grill-me). Diese Decisions verfeinern/ergänzen 1–8.

- **D9 — Player-Auslieferung.** ⛔ **Teilweise überholt (siehe „Aktueller Stand" Pkt. 8):** Variante (a) **Browser-Join ist verworfen/deferred** (bräuchte einen Server, den es nicht gibt). Es gilt nur (b): **„Player-Modus" derselben Tauri-App** (kein zweiter .exe, kein zweiter Build). Datenquelle immer = Host über WebRTC, nie lokale DB.
- **D10 — Player-„Projekt" = gespeicherte, wiederöffenbare Host-Referenz.** Persistierter Eintrag: Host-Label · URL/IP · Einladungscode · Token · Anzeigename · Session-Name · zuletzt-online. **Kein autoritatives lokales Weltabbild** — Inhalte werden vom Host gestreamt, online höchstens gecacht, **offline → leerer „Host offline"-Zustand**. **Online-Erkennung = einmaliger Ping beim Öffnen + Retry-Icon (KEIN Heartbeat).** Bei IP-Wechsel: URL editierbar (Code/Token bleiben). **Ein Projekt-Eintritt pro Player-Client** → indirekt genau 1 Charakter pro Spieler.
- **D11 — Persistente Session am Projekt.** Roster (aktive Mitglieder, `status='active'` — D24), Gruppen, Einladungscode, Visibility-Overrides, Whiteboards und Session-Zeit **überleben** zwischen Spielabenden; „Hosten" = eingebetteten Server live schalten/stoppen. **Eine aktive Session pro Host** gleichzeitig. Player-Referenz reconnected zur selben Session (S10-Token, kein Neu-Join).
- **D12 — Lokal = Single-Owner + read-only-Welt-Spieler.** Owner-Rechte/Schreib-Delegation an Spieler **erst online (Stufe 3)**. Kein git/merge lokal. Spieler schreiben nie Welt-Inhalte.
- **D13 — Player-Interaktion = Hybrid.** Ein **Haupt-Interaktionsfeld mit Reitern: Map · Kampflog · Spotlight** (DM platziert dort frei, Whiteboard-Stil). **Zusätzlich frei browsen** durch alles Freigegebene (Entities/Bilder/Handouts/Kalender/eigener Charakter). Der Kampflog ist **auch für Spieler** sichtbar.
- **D14 — Player-Write-Scope.** Spieler schreibt nur **Eigenes**: eigener **Charakterbogen**, **eigener Token** (Bewegung — siehe D18), **Würfeln** (D17), **private Notizen** (D19-lokal). Nie Welt-Inhalte.
- **D15 — Inhalts-Umfang teilbar an Spieler.** Teilbar: **Entities** (gefiltert, read-only), **Bilder/Concept-Art/Handouts**, **Maps** (Fog + Tokens), **eigener Charakterbogen**, **Kalender** — aber **zeit-gated** (nur Ereignisse ≤ „Session-Jetzt", Zukunft nie ausgeliefert, D16). **DM-only, nie im Player-View:** Authoring, Knowledge-Graph, Soundboard.
- **D16 — Session-Zeit & Kalender-Gate.** Projekt hat einen **Startzeitpunkt**; der DM stellt in der Session **Tage/Wochen/Jahre vor** (+ absolut setzbar → `needs-decision`). Kalender-Filter **server-seitig**: nur Ereignisse mit Datum ≤ Session-Jetzt verlassen den Host. Session-Jetzt persistiert.
- **D17 — Würfel.** Generischer **dNN-Roller** (z.B. `2d6+3`). Pro Wurf wählt Werfer/DM vorab die **Sichtbarkeit: Privat / nur DM / Alle**; Ergebnis postet in den **Kampflog**, **server-seitig** nach Sichtbarkeit geroutet (Client filtert nie). Plugin-Wurf-Shortcuts + verdeckte Würfe = später.
- **D18 — Token-Bewegung im Multiplayer (löst #299).** **Default: jeder aktive Spieler (`status='active'`, D24) bewegt jeden Token**, Bewegung **live an alle**. Optionaler **DM-Lock** (per-Token/global) = spätere Kür (`needs-decision`). Token-Bewegung ist **rein visuell**, Regel-Einhaltung per Absprache (kein erzwungenes Grid/Reichweite).
- **D19 — Spotlight/Whiteboard + private Notizen.** Whiteboard = **Gemeinsam (global, alle Spieler)** + **pro Spieler ein privates**, das **nur der DM bespielt** (per-Spieler-Geheimnisse; Spieler read-only). Platzierbar: **Entity-Refs + Freitext-Notizen + Bilder**. Whiteboards persistieren mit der Session (host-seitig; per-Spieler-Board geht **nur** an den Zielspieler). **Private Notizen des Spielers** = eigenes Feature, **player-seitig lokal gespeichert** (einzige echte lokale Speicherung, echt privat, geräte-gebunden).
- **D20 — Transport + Live-Kanäle.** ⛔ **Transport-Mechanik überholt (siehe „Aktueller Stand"):** Der Live-Kanal ist der **WebRTC-DataChannel** (bidirektional), **kein** HTTP-Server/WebSocket. Der Rest gilt unverändert — **Live gepusht:** Freigaben (S09), Token-Bewegungen (D18), Spotlight/Whiteboard (D19), Kampflog-Einträge (D17/Kampf), Session-Zeit/Kalender-Gate (D16). Eigener Charakterbogen live editierbar; fremde Bögen nicht sichtbar. **Host-durchgesetzt:** Visibility (S09), Wurf-Sichtbarkeit (D17), Whiteboard-Privatheit (D19), Fog (nur aufgedeckt), Kalender-Gate (D16). **Kein Rate-Limit in V1** (Spieler read-only, DM kickt jederzeit).
- **D21 — Split-View (allgemeine App-Fähigkeit).** In-App **2-Pane-Split-View** (beliebige 2 Ansichten nebeneinander, verschiebbare Grenze) — v.a. für den DM (Map ‖ Kampflog). Cross-Cutting, eigene kleine Story. OS-Pop-out = später.
- **D22 — Kampf-Engine = eigenes Sub-Epic.** Runden/Initiative/Aktions-Auflösung/HP-Status sind ein eigenständiges Subsystem → **`planning/epics/M10b-combat-engine.md`** (Ausgangspunkt: Grill-Q20–Q25). M10 (Multiplayer) referenziert es; der Kampflog-Reiter (D13) ist die Multiplayer-Sicht darauf. Baseline plugin-frei (HP/Schaden/Heilen/Würfe/Initiative/Runden), Plugin reichert an.

- **D23 — 3-Schichten-Modell: Welt → Campaign → Session (Terminologie geklärt).** „Session" wurde im Gespräch deutsch = die ganze Kampagne gemeint; im Code/DB heißt **Session = ein Termin**. Aufgelöst:
  - **Welt (Basis):** kanonische Entities/Events/Kalender, geteilt.
  - **Campaign (die Klammer, pro Gruppe):** hier leben **Entity-Overrides + Events + Roster + Visibility + Weltzeit-Stand**. Eine Welt trägt **mehrere Campaigns** (z.B. 4 Gruppen). Persistiert über alle Termine.
  - **Session (ein Termin):** **nur Notiz-/Log-Layer** (`sessions`, `capture_notes`, `session_log`), locker nummeriert, referenziert die Campaign.
  - **Default:** Entity-/Event-Edits in der Runde landen als **Campaign-Override** (`campaign_entity_overrides.patch_json`) — die **Basis-Welt bleibt unberührt**. **Optionaler Promote-Schalter** hebt einen Override in die Basis-Welt (für „geiler Plot für alle Gruppen").
  - **Campaign-weites Log = UI-Aggregation**, KEIN extra Log: alle `session_log`-Einträge der Campaign-Sessions chronologisch, Trennstrich bei jedem Session-Wechsel. `session_log` bleibt unverändert (hat `session_id` + `created_at`).
  - **⚠️ Reconciliation:** Wo D9–D22 „Session" als *persistente Klammer* sagen (Roster/Gruppen/Visibility/Overrides/Weltzeit „überleben zwischen Spielabenden", D11), ist **Campaign** gemeint. Die M10-Tabellen (`session_players`, `player_groups.session_id`, `session_visibility_overrides.session_id`) hängen aktuell an `session_id` → gehören konzeptuell an die **Campaign**.
  - **Schema-Konsequenz (`needs-design`, nicht sofort bauen):** neue **`campaigns`**-Tabelle als Klammer + `campaign_id` auf Override-/Event-/Roster-/Visibility-Tabellen; `campaign_entity_overrides` bekommt `campaign_id` (heute un-gekeyt → nur 1 Campaign/Welt möglich); `sessions` bekommt `campaign_id`. **Kein** neues Log-/Notiz-Objekt nötig.
  - **⚠️ Umsetzung = einfaches Re-Keying, KEINE Migration/Compat.** Dev-Modus → **keine Abwärtskompatibilität**: `session_id` in den betroffenen Tabellen/Services direkt durch `campaign_id` **ersetzen**, `schema.sql` ändern, **Dev-DB wegwerfen**. Kein Dual-Key, keine Migrations-/Backfill-Funktion, kein Shim. Der einzige Aufwand ist der Code, der `session_id` hartverdrahtet.

## Nachschärfung 2026-08-15 (Live-Test-Feedback) — Decisions 24–27

Live-Test der gemounteten Multiplayer-UI zeigte: das Approve-Gate-Modell und die geleakte Stufe-3-Signaling-UI entsprechen **nicht** dem gewünschten Ablauf. Korrektur:

- **D24 — Auto-Join, KEIN Approve-Gate (überschreibt Decision 4).** Der DM erzeugt **einen** Einladungscode/-Link. **Wer den Code benutzt, ist sofort aktives Mitglied** — kein `pending`, kein Bestätigen/Ablehnen durch den DM. Der einzige Gate ist **nachträglich**: der DM kann jederzeit **kicken** (invalidiert dessen Token), und **Code-neu-generieren** invalidiert den alten Code für *neue* Joins (bestehende Spieler behalten ihr Token → Reconnect D11). Konsequenz: `session_players.invite_status` verliert `pending`/`rejected`; ein Join legt direkt einen aktiven Eintrag an. `rejected`/Fehler nur noch bei **ungültigem Code / Server nicht erreichbar**, nicht durch DM-Entscheidung. **Wo D9–D22, S02, S05, S06 „`pending`/`approved`/`approve`" sagen, gilt D24.**
- **D25 — Ganze-App-Transformation via Top-Bar-Toggle (2026-08-16 neugefasst, ersetzt die frühere „Content-Pane-Swap"-Fassung).** Ein **globaler, immer sichtbarer Umschalter in der Top-Bar** („Bearbeiten ⟷ Spielen") transformiert die **gesamte App-Shell** — nicht nur den Hauptbereich. Gilt vorerst **nur für die DM-App** (eine eigene Player-.exe existiert noch **nicht** → später; dann bootet die Player-App direkt read-only ohne Toggle).
  - **Bearbeiten (Autor):** volles Menü (**alle** AREAS aus `WorkspaceShell`), alle Edit-Affordances sichtbar, editiert die **Welt-Basis**.
  - **Spielen (Session):** Der **Eintritt verlangt zwei Angaben** — (1) **welche Session/Campaign** (bei mehreren Gruppen wählbar, D23) und (2) **welche Rolle: als DM oder als Player**. Danach:
    - **Menü schrumpft auf einen FESTEN Play-Subset** (nicht konfigurierbar): **`entities` 🗂, `search` 🔍, `maps` 🗺, `calendar` 📅, `session` 🎲** (= Play-Cockpit Map/Kampflog/Spotlight). Alle anderen Bereiche (chronicle/cards/plugins/rules/audio/graph/project) sind im Spielen-Modus **nicht** im Menü.
    - **Menü ist für DM und Player IDENTISCH** — einziger Unterschied ist die **Rolle**: **DM** behält alle **Edit-Buttons/-Affordances**; **Player** ist **read-only** (alle Create/Edit/Delete-Buttons ausgeblendet, sieht nur Freigegebenes).
    - **DM-only-Tools (`audio` 🎧 Soundboard, `graph` 🌌) bleiben im Bearbeiten-Modus** — dorthin wechselt der DM bei Bedarf; sie sind **nicht** Teil des Play-Subsets.
  - **Entkoppelt von D23:** Sowohl Bearbeiten als auch Spielen(DM) editieren die **Welt-Basis**. Der Toggle ist **kein** Daten-Layer-Schalter; die Override-/Promote-Ebene (D23/S21) ist ein separates Thema und nicht an den Toggle gekoppelt.
  - **Zwei Stories:** **S22** = Mode-Shell (Toggle + Mode/Rolle/Session-Kontext + Eintritts-Auswahl + Menü-Reduktion). **S23** = read-only Player-Gating (Edit-Affordances app-weit ausblenden, liest den S22-Kontext) — cross-cutting.
  - **Player-Modus = derselbe Build** (kein zweiter .exe). **Browser-Join (D9-Variante a) deferred** — jetzt App-Modus + GM-Self-Join (D26) zuerst; D9 bleibt End-Ziel.
- **D26 — GM-Self-Join = „als Player beitreten" in der DM-App (Konkretisierung via D25).** Der DM wechselt auf **Spielen** und wählt beim Eintritt die Rolle **Player** (statt DM) — die App verbindet gegen den **eigenen laufenden Server (loopback)** und rendert die read-only Player-Sicht (S23-Gating aktiv). Ein Gerät = hosten **und** als Spieler mitspielen. Die DM-App braucht also **beide** Eintritts-Optionen (mit/ohne Bearbeiter-Rechte). Kein zweites Gerät, kein zweiter Build.
- **D27 — Copy-UX für Einladungscode/-Link (Standard).** Der Code steht in einem **gesperrten (readonly) Input-Feld** mit **Copy-Button** (Klick kopiert in die Zwischenablage, sichtbares Feedback „kopiert") — **nicht** als nacktes Text-Element. Zusätzlich ein teilbarer **Einladungs-Link** (Server-URL + Code kombiniert) mit eigenem Copy-Button. Kein WebRTC-„Antwort-Code"-Rückkanal in Stufe 2 — die manuelle Offer/Answer-Signaling-UI (SignalingPanel, S12) erscheint **ausschließlich** in der Stufe-3-Sicht, **nie** in der LAN-Lobby.

- **D28 — Signaling-Modell = Host/Connect wie klassische Multiplayer-Games (löst S11/S12-Richtung, 2026-08).** Ziel-UX: **der DM hostet, Spieler verbinden sich per Einladungslink/-Code** — der Host ist autoritativ, **Spieldaten laufen P2P host↔Spieler** (WebRTC-DataChannel, Aktueller Stand). Technisch = **Ecke B** des Signaling-Trilemmas:
  - **Fremder Gratis-Signaling-Broker** (öffentlich, nicht selbst gehostet) = die „Matchmaking-Lobby" (wie früher Battle.net/Master-Server): reicht beim Verbinden **einmal** SDP/ICE weiter, danach raus. **Keine** Spieldaten über den Broker. **Kein Port-Forwarding** (STUN für NAT).
  - **„Kein gehosteter Signaling-Server" ist damit präzisiert:** kein **selbst** betriebener Server; ein **fremder Gratis-Broker** ist ausdrücklich ok.
  - **LAN (gleiches Netz):** funktioniert auch **ohne** Broker (lokale Discovery / direkte Verbindung) — Zero-Config am Tisch.
  - **Fallback:** manueller Offer/Answer (SignalingPanel, Stufe-3-only) bei Broker-Ausfall / ~10–20 % strengen NATs.
  - **AUSTAUSCHBAR bauen (Roadmap-Intent):** Das Signaling sitzt hinter einem **Interface** (analog Transport-Interface S01) — der Gratis-Broker (Trystero/Nostr) ist **eine** Implementierung, **kein** Lock-in. **v2/v3 ersetzt ihn durch einen selbst gehosteten Relay-Server**, ohne Rewrite des Rests. (Trystero hat schon eine self-hosted-WebSocket-Relay-Strategie = natürlicher Upgrade-Pfad.)
  - **Broker-Wahl = OFFENER Spike #380 (ergebnisoffen).** Recherche (`planning/research/multiplayer-signaling-broker-options.md`) liefert die **Hypothese Trystero (MIT) + Nostr** (Alternativen: PeerJS-Cloud, manueller SDP) — aber **nicht vorentschieden**: der Spike testet Trystero/PeerJS/manuell **gleichwertig im echten Tauri-Build** (Win WebView2 + macOS WKWebView) und darf Trystero verwerfen. #367/#368 sind `blocked` durch #380. (Lektion: beim ersten Mal zu schnell auf Trystero eingeschossen.)

## Nachschärfung 2026-08-25 (Regression-Analyse) — Decisions 29–31

Live-Test der rebuild-Schiene (`planning/M10-multiplayer-regression-analysis.md`) zeigte: „Multiplayer" war eine **lokale DM-Vorschau** (Transport toter Code, Client las lokale DB), Player-Charaktere verschmutzten `base_entities`, Roster lag im falschen Modus. **Root Cause = die Issues (Requirement), nicht die Implementer:** tragende Invarianten waren nie harte, testbare ACs. Korrektur:

- **D29 — Host↔Client-Membran (Play-Modus-Architektur).** Der **Client ist DB-los und transport-gespeist**; der **Host** ist DB-Eigner, filtert **pro Empfänger** (S07/S09) und **pusht Initial-Snapshot + Live-Deltas** über den DataChannel.
  - Client hat **NIE** SQLite/`database`/`useDatabase`; er rendert aus einem **flüchtigen, gecachten Transport-Store** (darf freigegebene Entities im Hintergrund **vorladen**; offline = leerer „Host offline"-Zustand, D10).
  - **Die Membran ist HART auch im selben Prozess:** **GM-Self-Join (D26) läuft über Loopback-Transport, NICHT** über einen DB-Shortcut. Dadurch testet **jedes Hosten** automatisch den echten Client-Pfad mit.
  - Filter **host-seitig**, Client filtert **nie** (Decision 8) — dadurch erstmals **testbar**.
  - **Absicherung (Pflicht-Tests):** Guard „Client-Komponenten importieren **kein** `database`/`useDatabase`" (grep=0) **+** Integrationstest „`gm_only` überquert die Membran **nie**".
  - **Konsequenz:** der Transport (S01/S11/S12) wird **vorgezogen** und wirklich verdrahtet (`WebRtcTransport.host(db)` + `attachVisibilityBroadcaster` + Client-Store), bevor Play-Features als „Multiplayer" gelten. Bis dahin ausdrücklich **lokale DM-Vorschau**.
- **D30 — Player-Charaktere in eigener campaign-scoped Tabelle (NICHT `base_entities`).** Player-Charaktere kommen **raus** aus `base_entities` → eigene Tabelle (z.B. `player_characters`, campaign-gekeyt). `base_entities` bleibt **ausschließlich** World-Building (Leitplanke 1/2). Der Bogen darf **entity-ähnlich strukturiert** sein, verschmutzt aber **nie** Welt-Bibliothek/Suche/Graph/Relations-Picker. **Überschreibt S08's „Charakter = Entity".**
- **D31 — Roster/Mitglieder/Gruppen-Zuordnung = Play-/Live-Modus.** Diese leben im **Play-/Live-Kontext (Lobby, S06)** — dort existieren Mitglieder (via `joinWithCode`). Der **Edit-Modus** behält nur **Campaign-CRUD + persistenten Invite-Code** (+ optional Gruppen-**Namen** definieren; **Zuordnung erst live**). Session-/Laufzeit-Konzepte gehören nicht in die Autoren-Fläche. **Korrigiert S24's Edit-Modus-Platzierung.**

### Regressions-Fix-Cluster (2026-08-25 · GitHub = Wahrheit)
- **Anker (D29-Membran, P0, Reihenfolge zwingend):** **#372** Play-Sync-Protokoll + Client-Store-Contract → **#373** Host-Push-Pfad → **#374** DB-loser Client-Store + Guard → **#375** GM-Self-Join-Loopback + Membran-Integrationstest.
- **#376 (P0)** Player-Charaktere → eigene Tabelle `player_characters` (D30).
- **#371 (P1, offen, geschärft)** Invite-Code-UX + Edit-Panel = CRUD + Code + Gruppen-**Namen** (D31).
- **#377 (P1)** Roster/Mitglieder/Gruppen-**Zuordnung** → Play-Lobby (D31).
- **#378 (non-M10/M14)** `base_entities`-Grenze-Audit (Mechanik vs. narrativ).
- **Reihenfolge:** #372→#373→#374→#375 (Membran) ∥ #376 (Entity); dann #371 + #377. **Bis die Membran (#372–#375) steht, ist Play-Modus ausdrücklich lokale DM-Vorschau.**

### Detailfragen — Stand
- ✅ **Session-Jetzt absolut setzbar?** → **JA, beides** (voranschreiten + absolut setzen), S17/#363.
- ✅ **Token-Lock?** → **Nein in V1** (jeder bewegt jeden, kein Lock; Lock = spätere Kür), #366.
- ✅ **Promote-Granularität?** → **ganze Entity, reversibel**, S21/#365.
- ✅ **Split-View Pop-out?** → **nur In-App in V1**, OS-Pop-out später, S19/#364.
- ✅ **Remote-Signaling?** → **D28: Host/Connect via Gratis-Broker (Ecke B)**; Rest nur noch Broker-Wahl (Mini-Spike), S11/S12.
- ⏳ **offen:** Öffentlicher vs. privater **Kampfzustand** (fremde HP/Status?) → Combat-Sub-Epic (`M10b`, eigene Grill-Runde).
- ⏳ **offen (aus #333 gesichert):** **Per-Gruppen-Spotlight/Whiteboard** (statt nur global + per-Spieler) — spätere Kür zu S15/#361.

## Out of Scope

- **TURN/coturn-Relay** (self-hosted Infra) und ein **gehosteter Signaling-Server**. (WebRTC-DataChannel + STUN sind IN scope — siehe „Aktueller Stand".)
- **Eingebetteter HTTP/WS-Server + Browser-Join** (nie gebaut, durch WebRTC/App-Modus ersetzt).
- Echtzeit-Kollaboration mehrerer GMs
- Cloud-Accounts / globale Spieler-Identität über Sessions hinweg
- Cross-Session World State (eigenes Konzept, #156)
- Voice/Video/Chat
- Zusätzliche Transport-Härtung über WebRTC/DTLS hinaus (WebRTC-DataChannel ist bereits DTLS-verschlüsselt; App-Layer-Vertrauensmodell = LAN/Freundeskreis)

## Stories

> **⚠️ Die Story-Texte unten sind der ursprüngliche Stand (vor D23–D31).** Autoritativ pro Story ist das **verlinkte Rebuild-Issue** (Story-Tracking-Tabelle) **+ die Decisions/„Aktueller Stand"**. Wo ein Story-Text mit einer Decision kollidiert, **gewinnt die Decision** — die wichtigsten Kollisionen sind unten inline mit **⛔ ÜBERHOLT** markiert (D29 DB-loser Client, D30 eigene Char-Tabelle, D31 Roster im Play-Modus). Terminologie: „Session"/`session_id` in Alt-Texten = **Campaign**/`campaign_id` (D23-Reconciliation).

### M10-S01: WebRTC-Transport & Host-Lebenszyklus

> **Neugefasst 2026-08 (siehe „Aktueller Stand"):** die alte AC „Rust-HTTP/WS-LAN-Server + Port-Bind" ist **obsolet** — es gibt keinen Server. Transport ist **WebRTC-DataChannel**.

**Ziel:** Der DM hostet eine Campaign als **WebRTC-Peer** hinter dem austauschbaren Transport-Interface; jede eingehende Nachricht wird host-seitig validiert.

**AC:**
- Transport-Interface (`src/services/session-transport.ts`) kapselt Senden/Empfangen; konkrete Implementierung `webrtc-transport.ts` (DataChannel). Renderer redet nur gegen das Interface.
- Host-Peer startet beim Hosten einer Campaign, endet beim Schließen — keine offene Verbindung ohne gehostete Campaign.
- Alle eingehenden Nachrichten host-seitig **schema-validiert** vor Verarbeitung — kein ungeprüftes Payload.
- Lokal testbar via Loopback/Same-Machine-Peer (D26); remote via STUN (kein TURN, kein gehosteter Signaling-Server).
- **`needs-design`:** Signaling-Austausch, damit „Link/Code einfügen → drin" **ohne** manuelles Offer/Answer-Copy-Paste auch remote klappt (siehe „Aktueller Stand", offener Punkt). Betrifft S11/S12.
- Blocked by #152 (Session-Schema & Persistenz).
- `database`/Transport prop typed as `DatabaseLike`/Interface; no `unknown`/`as never`.

---

### M10-S02: Session-Identität, Einladungscodes & Token-Auth

**Ziel:** Sessions sind eindeutig identifizierbar und Spieler authentifizieren sich über Einladungscode + Token.

**AC:**
- Session erhält bei Erstellung GUID + Hash; Persistenz im Session-Objekt (→ M8-S01)
- DM generiert pro Session einen Einladungscode (kurz, am Tisch teilbar) — neu generierbar (invalidiert alten)
- Spieler-Join mit gültigem Code erzeugt ein Spieler-Token **und macht den Spieler sofort zum aktiven Mitglied** (D24 — kein Approve-Schritt)
- Auth-Middleware: jede Server-Anfrage ohne gültiges, **aktives (nicht gekicktes)** Token wird abgewiesen — **jede Nachricht** trägt das Token (Server-seitige Durchsetzung, Decision 8; nicht nur beim Handshake)
- Einladungscode kryptografisch zufällig (`crypto.getRandomValues`/Rust-Äquivalent), nicht erratbar
- Tokens werden nie geloggt und nie an andere Spieler ausgeliefert
- Blocked by #152 (Session-Schema & Persistenz)
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M10-S03: Spieler-Mitgliedschaft — Schema & Services

**Ziel:** Spieler-Mitgliedschaften in einer Session sind persistiert und verwaltbar.

**AC:**
- Tabellen: `players` (id, display_name, created_at), `session_players` (session_id, player_id, token_hash, status: `active|kicked`, joined_at) — **kein `pending`/`rejected` (D24: Auto-Join)**
- Service: createPlayer, **joinWithCode** (legt direkt `active` an), kick, listSessionPlayers — **kein `requestJoin`/`approve`/`reject`**
- `active` Mitgliedschaften gelten als aktive Spieler; Kick setzt `kicked` + invalidiert Token
- Mehrere Spieler pro Session; ein Spieler-Token gehört zu genau einer Session
- Fehlerhafte/fehlende Daten → klare Fehlermeldung, kein Crash
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API

---

### M10-S04: Spieler-Gruppen

**Ziel:** DM kann Spieler zu Gruppen zusammenfassen, um Sichtbarkeit gebündelt zu vergeben.

**AC:**
- Tabellen: `player_groups` (id, session_id, name), `player_group_members` (group_id, player_id)
- Service: createGroup, renameGroup, deleteGroup, addMember, removeMember, listGroups
- Ein Spieler kann in mehreren Gruppen sein
- Gruppen sind session-scoped (keine globalen Gruppen)
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M10-S05: „Campaign beitreten" (Spieler-Modus-Client) — **AUTO-JOIN (D24)**

**Ziel:** Ein Spieler klickt **„Campaign beitreten"**, fügt den **Einladungslink/-Code** ein (+ Anzeigename) und ist **sofort drin** — kein Server-URL-Feld, kein Warten auf Bestätigung.

**AC (D24/D25/D26):**
- Einstieg **„Campaign beitreten"** (**derselbe Build**, D25): **ein** Feld für den **Einladungslink/-Code** (der Link trägt die Verbindungs-/Rendezvous-Info — siehe Aktueller Stand, Signaling `needs-design`; **kein separates Server-URL-Feld**) + Anzeigename.
- Nach Einfügen eines **gültigen** Links/Codes: **sofort aktives Mitglied** der Campaign, direkter Übergang zur Charaktererstellung (→ M10-S08). **Kein `pending`, kein „Warte auf Bestätigung".**
- Fehlerfall NUR bei **ungültigem Link/Code** oder **Host nicht erreichbar** (klare Meldung) — **nie** eine DM-Ablehnung.
- **GM-Self-Join (D26):** derselbe Einstieg akzeptiert den **loopback/eigenen** Link, sodass der Host als Spieler der eigenen Campaign beitritt.
- **UI-Basics:** Eingaben als `Field`, Beitreten als `Button` (`accent`), Fehler als `StatusChip` (`failure`), Form in `Panel` — aus `src/ui/primitives.tsx`, kein nacktes HTML.
- ⛔ **ÜBERHOLT (D29/R4):** ~~automatischer Reconnect-Versuch beim Mount~~ → **kein stiller Auto-Reconnect** (das war der lokale Schein-Join). Reconnect nur **explizit**. Und: der Client ist **DB-los** (D29) — **kein `database`-Prop**, er konsumiert über den Transport-Store (R3).
- Blocked by #154 (Play-Mode Screen) — **geschlossen**; realer Gate = S01/S02.
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API.

---

### M10-S06: GM-Lobby (Verbundene Spieler + Kick + Copy-Code) — **KEIN Approve (D24/D27)**

**Ziel:** Der DM sieht die **live verbundenen** Spieler, kann kicken, und teilt den Einladungscode/-Link bequem.

**AC (D24/D27):**
- Lobby-Panel im Play-Modus zeigt **eine** Liste: **verbundene Spieler** (Anzeigename + online/offline-Status). **KEINE `pending`-Liste, KEINE Approve/Reject-Buttons** — Auto-Join (D24).
- Aktion je Spieler: **Kick** (entfernt aktiven Spieler, invalidiert dessen Token).
- **Einladungscode in gesperrtem (readonly) Input-Feld + Copy-Button** (D27): Klick kopiert in die Zwischenablage mit sichtbarem „kopiert"-Feedback. Zusätzlich **teilbarer Einladungs-Link** (URL+Code) mit eigenem Copy-Button.
- **Code neu generieren** (invalidiert alten Code für neue Joins; bestehende Spieler behalten Token).
- Zuordnung von Spielern zu Gruppen (→ M10-S04) direkt aus der Lobby.
- **SignalingPanel (Stufe-3-Offer/Answer) ist HIER NICHT gemountet** (D27) — LAN-Lobby zeigt keine „Antwort-Code"-Mechanik.
- Copy in die Zwischenablage über die **Tauri-Clipboard-API bzw. `navigator.clipboard`**, nicht `prompt()`/`alert()`.
- Mount: Lobby wird im **Play-Mode-Cockpit** (`PlayModeView`, role `dm`) über den Lobby-Button erreicht — Integrationstest durch diesen echten Pfad (nicht nur isoliertes `render(<LobbyPanel/>)`).
- **UI-Basics:** Spielerliste als `ListSurface`, Kick als `Button`, online/offline als `StatusChip`, Code als readonly `Field` + Copy-`Button`, Rahmen `Panel` — aus `src/ui/primitives.tsx`, kein nacktes HTML.
- `database` prop typed as `DatabaseLike`; no `unknown`/`as never`.

---

### M10-S22: App-Mode-Shell — Top-Bar-Toggle + Mode/Rolle/Session-Kontext + Menü-Reduktion (D25)

**Ziel:** Der Top-Bar-Toggle **transformiert die ganze App-Shell** zwischen **Bearbeiten** (voller Autor-Workspace) und **Spielen** (Session-Sicht mit reduziertem Menü). Beim Eintritt in „Spielen" wählt der DM **Session/Campaign + Rolle (DM/Player)**. (5× reklamiert, dass der Toggle fehlt — hier wird er als Shell-Mechanismus gebaut.)

**WIE — mechanisch, kein Interpretationsspielraum:**
- **Mount-Punkt:** Toggle in der **Top-Bar/Kopfzeile von `src/ui/WorkspaceShell.tsx`** (neben Sprache/Theme, siehe Screenshot), in **beiden** Modi sichtbar. Nicht in der Seitenleiste, nicht in `PlayModeView`.
- **Shell-Kontext (benanntes Interface, von S23 + Areas gelesen):** `WorkspaceShell` hält und stellt bereit:
  - `mode: 'edit' | 'play'` (Default `'edit'`)
  - `sessionRole: 'dm' | 'player' | null` (nur in `play` gesetzt)
  - `activeSessionId: string | null` (in `play` gesetzt)
  Bereitstellung über einen **React-Context** (z.B. `AppModeContext` in `src/ui/`), damit beliebige Komponenten (S23-Gating) `mode`/`sessionRole` lesen können, **ohne** prop-drilling. Interface-Namen im Ticket fixieren.
- **Eintritts-Auswahl beim Klick auf „Spielen":** ein kleiner Auswahl-Schritt (Panel/Dialog) fragt **(1) Session/Campaign** (Liste; bei genau einer automatisch vorgewählt) **und (2) Rolle: „als DM" / „als Player"**. Erst danach `mode='play'`, `sessionRole`, `activeSessionId` setzen. „Als Player" = GM-Self-Join (D26, loopback).
- **Menü-Reduktion:** Die `AREAS`-Liste in `WorkspaceShell` wird im `play`-Modus auf den **festen Play-Subset** gefiltert: **`entities`, `search`, `maps`, `calendar`, `session`** (in dieser Reihenfolge). Alle anderen Bereiche verschwinden aus der Seitenleiste. Der Subset ist **identisch** für `sessionRole` `dm` und `player`. Im `edit`-Modus bleibt die **volle** `AREAS`-Liste.
- **`session` 🎲 im Play-Modus** = das Play-Cockpit (`PlayModeView`), mit `role={sessionRole}` und `activeSessionId`. Der Toggle ist der **primäre** Play-Zugang; das 🎲-Icon lebt jetzt im Play-Subset.
- **Prop-Fluss (⚠️ D29-Grenze):** `activeSessionId`/`sessionRole` fließen an `PlayModeView`. **`database` NUR im Host/DM-Kontext** — im **Player-Modus** (`sessionRole='player'`, inkl. GM-Self-Join) ist `PlayModeView` **DB-los** und rendert aus dem Transport-Store (R3), **kein** `database`-Prop.

**AC:**
- Toggle `data-testid="mode-toggle"` in der `WorkspaceShell`-Kopfzeile, in beiden Modi sichtbar; aktiver Modus via `aria-pressed`.
- Klick „Spielen" → Auswahl-Schritt (Session + Rolle) → danach `mode='play'`: Seitenleiste zeigt **nur** `entities/search/maps/calendar/session`, alle anderen Icons weg. Klick „Bearbeiten" → volle `AREAS` zurück, `sessionRole`/`activeSessionId` = null.
- Rolle „als Player" setzt `sessionRole='player'` (verbindet loopback, D26); „als DM" setzt `'dm'`.
- `AppModeContext` (o.ä.) stellt `mode`, `sessionRole`, `activeSessionId` app-weit bereit — **von S23 konsumierbar**.
- Keine hardcodierten Strings — `useTranslation` + Inline-Default.
- **Integrationstest durch den echten Mount (Pflicht, AGENTS.md:80):** rendert `WorkspaceShell`, klickt `mode-toggle` → Auswahl (Rolle DM) → erwartet reduzierte Seitenleiste (genau die 5, keine `graph`/`audio`/`project`-Icons) + `PlayModeView`-Inhalt; klickt „Bearbeiten" → volle Seitenleiste zurück. Zweiter Fall: Rolle „Player" → `sessionRole='player'` im Kontext.
- `database` prop typed as `DatabaseLike`; no `unknown`/`as never`.
- **UI-Basics:** Toggle als Segmented-Control aus zwei `Button`s (aktiv `accent`+`aria-pressed`, inaktiv `neutral`) — aus `src/ui/primitives.tsx`; Eintritts-Auswahl als `Panel` + `Button`s + Session-Liste, kein nacktes HTML. Import/Tokens siehe #342-Ticket.

**Out of scope:** Das Ausblenden der Edit-Buttons selbst (**S23**), Cockpit-Inhalte (S14 ff.), Player-Join übers Netz (S05), echte Player-.exe (deferred).

---

### M10-S23: Read-only Player-Gating — Edit-Affordances app-weit ausblenden (D25, cross-cutting)

**Ziel:** Im Spielen-Modus mit `sessionRole === 'player'` sieht der Nutzer **nur** — **alle** Create/Edit/Delete-Buttons und -Menüs sind ausgeblendet. Der DM (`sessionRole === 'dm'`) und der Bearbeiten-Modus behalten sie. Cross-cutting über alle Play-Subset-Bereiche.

**WIE — mechanisch:**
- **Single Source of Truth:** liest den **`AppModeContext`** aus S22. Ein abgeleitetes Flag **`readOnly = (mode === 'play' && sessionRole === 'player')`** — an **einer** Stelle definiert (z.B. Hook `useReadOnly()`), nirgends dupliziert.
- **Gating-Punkte (jede Play-Subset-Fläche):** in `entities` (Detail/Browser: „+ Neu", Bearbeiten-Stift, Löschen), `maps` (Marker/Token-Edit, außer eigener Token-Bewegung — D18/D14), `calendar` (Event anlegen/bearbeiten), `session`-Cockpit (nur eigener Charakterbogen editierbar, D14). Bei `readOnly` werden diese Affordances **nicht gerendert** (nicht nur `disabled`).
- **Spieler-Ausnahmen (D14/D18 bleiben erlaubt):** eigener Charakterbogen editierbar, eigener Token bewegbar, Würfeln, private Notizen. Also `readOnly` gilt für **Welt-Inhalte**, nicht für die spielereigenen Aktionen.
- **Content-Sichtbarkeit** (welche Entities/Events ein Player überhaupt sieht) läuft weiter über das Visibility-System (S07/S09) — S23 betrifft nur die **Edit-Affordances**, nicht welche Daten geladen werden.

**AC:**
- Bei `mode='play'` + `sessionRole='player'`: in `entities`/`maps`/`calendar`/`session` erscheinen **keine** „Neu"/Bearbeiten/Löschen-Buttons.
- Bei `sessionRole='dm'` **oder** `mode='edit'`: alle Affordances wie gehabt sichtbar.
- Spielereigene Aktionen (eigener Bogen, eigener Token, Würfeln, private Notizen) bleiben auch bei `readOnly` möglich (D14/D18).
- **Ein** zentrales `readOnly`/`useReadOnly()` — kein dupliziertes `mode==='play' && role==='player'` verstreut.
- **Integrationstest:** `WorkspaceShell` in `play` als `player` gerendert → Guard: kein Element mit „Neu"/Bearbeiten/Löschen in den Play-Bereichen; als `dm` → vorhanden. (Test durch den echten Shell-Mount, nicht isolierte Komponenten.)
- Keine hardcodierten Strings; `database` `DatabaseLike`.

**Blocked by S22** (braucht den `AppModeContext`).

**Out of scope:** Content-Visibility (S07/S09), Netz-Transport der Rechte-Durchsetzung (server-seitig, Decision 8/S01).

---

### M10-S24: Campaign-Verwaltungs-Panel (Edit-Modus)

> ⛔ **NEUGEFASST (D31):** ~~volle Roster-/Mitglieder-Verwaltung + Gruppen-Zuordnung im Edit-Modus~~ — das war der Fehler (im Edit-Modus existieren **keine** Mitglieder, die joinen erst live). **Roster, Mitglieder, Gruppen-Zuordnung → Play-/Live-Lobby (S06).** S24 wird auf ein **schlankes Edit-Modus-Panel** reduziert: **Campaign-CRUD + persistenter Invite-Code (Copy) + optional Gruppen-NAMEN definieren.** Zuordnung erst live.

**Ziel:** Im **Edit-Modus** eine Campaign verwalten: anlegen/umbenennen/löschen, den **persistenten Einladungscode** anzeigen+kopieren, optional **Gruppen-Namen** definieren. **Keine** Mitglieder-/Roster-/Zuordnungs-Funktion (die lebt in S06).

**WIE:**
- Panel im **Campaign-Kontext (Edit-Modus)** — Mount-Punkt im Ticket benennen (nicht nur `render(<Panel/>)`).
- Aktionen: **Campaign anlegen/umbenennen/löschen**; **persistenten Einladungscode** anzeigen (aus DB beim Mount geladen — nicht nur React-State, sonst verschwindet er beim Menüwechsel) + **kopieren** (D27); **Einladungscode neu generieren** nur auf **explizite** Aktion; optional **Gruppen-NAMEN** definieren (`createGroup`, nur Name — **keine** Zuordnung).
- **„Neue Campaign"-Form einklappen**, sobald eine Campaign gewählt ist (nicht bedingungslos anzeigen).
- **Nicht hier (D31):** Mitglieder-Liste, Kick, Gruppen-**Zuordnung** → das ist **S06** (Play-Lobby), wo Mitglieder existieren.

**AC:**
- Campaign-CRUD; persistenter Code wird **beim Mount aus der DB geladen** und bleibt nach Menüwechsel kopierbar; Rotate nur explizit.
- Optional Gruppen-Namen anlegbar (echte Gruppen-**Liste** gerendert, kein verschwindender „Noch keine"-Text).
- **Keine** Mitglieder-/Kick-/Zuordnungs-Funktion im Edit-Panel.
- **UI-Basics:** Code als readonly `Field`+Copy-`Button`, Aktionen als `Button`, Gruppen-Liste als `ListSurface`, Rahmen `Panel` — aus `src/ui/primitives.tsx`.
- **Integrationstest durch den echten Mount** (AGENTS.md:80).
- `database` prop typed as `DatabaseLike`; no `unknown`/`as never`.

**Blocked by S20** (campaign-scoped `campaign_id`).

**Out of scope:** Roster/Mitglieder/Kick/Gruppen-Zuordnung (**S06**, D31), Transport/Signaling (S01/S11/S12).

---

### M10-S07: Per-Spieler/Gruppen-Visibility

**Ziel:** Der DM vergibt Sichtbarkeit pro einzelnem Spieler oder pro Gruppe; die Auswertung berücksichtigt die Spieler-Identität.

**AC:**
- `VisibilityContext` (`src/services/visibility-service.ts`) erweitert um `session_id`, `player_id`, `group_ids` — bestehende 4 Scopes bleiben unverändert
- Neue Tabelle `session_visibility_overrides` (session_id, target_type, target_id, scope, player_id NULL, group_id NULL)
- Auswertung: ein Inhalt ist für Spieler X sichtbar, wenn ein Override ihn (direkt oder über eine seiner Gruppen) freigibt; Default ohne Override = `gm_only`
- Visibility-Editor erweitert: statt binärem Dropdown Auswahl von Spielern/Gruppen (zusätzlich zu den bestehenden Scopes)
- Gilt für Entities, Marker (#81) und Bild-/Concept-Art-Assets gleichermaßen
- Default in einer Session: alles `gm_only` bis explizit freigegeben
- Kein Datenmodell-Konflikt mit Cross-Session World State (#156): Overrides sind session-scoped, kein Weltzeit-Promote
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M10-S08: Spieler-Charaktererstellung im Join-Flow

**Ziel:** Nach dem Join (sofort aktives Mitglied, D24) erstellt der Spieler einen Charakter auf Basis des Session-Regelwerks.

**AC:**
- Nach dem Join (aktives Mitglied, D24 — kein Approve-Schritt): Charaktererstellung auf Basis des `system_plugin_id` der Session (→ M9-S03 #166)
- Ohne System-Plugin: nur Basisfelder (Name, Freinotiz) — analog M8-S08 #160
- ⛔ **ÜBERHOLT (D30):** ~~Charakter wird als **Entity** in `base_entities` mit `is_player_character` angelegt~~ → Player-Charaktere liegen in **eigener campaign-scoped Tabelle `player_characters`** (Fix-Story), **nie** in `base_entities`. Der Bogen darf entity-ähnlich **strukturiert** sein, verschmutzt aber nie Welt-Bibliothek/Suche/Graph.
- Spieler kann nur seinen eigenen Charakter bearbeiten, nicht fremde
- ⛔ **(D29):** Im **Player-Modus** ist der Bogen **DB-los** (Transport-Store, R3); nur der **Host** schreibt in `player_characters`. Kein `database`-Prop auf der Client-Bogen-Sicht.
- Blocked by #166 (Player Character Schema & UI)

---

### M10-S09: Spieler-Live-Sicht (gefilterte Inhalte)

**Ziel:** Der Spieler sieht ausschließlich mit ihm geteilte Inhalte; Freigaben erscheinen live.

**AC:**
- Spieler-Client rendert nur Inhalte, für die ein gültiger Override existiert (Auswertung → M10-S07)
- Filterung erfolgt **server-seitig** — nicht freigegebene Inhalte verlassen den Server nicht (kein Client-seitiges Ausblenden)
- Neue/geänderte Freigaben durch den DM erscheinen ohne Reload beim Spieler (Push über Transport)
- Entzug einer Freigabe entfernt den Inhalt live aus der Spieler-Sicht
- Bilder/Concept-Art unterliegen derselben server-seitigen Filterung wie Texte
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M10-S10: Reconnect & Token-Persistenz

**Ziel:** Ein aktives Mitglied kann nach Verbindungsabbruch ohne erneuten Join zurückkehren.

**AC:**
- Spieler-Token wird lokal im Spieler-Client persistiert
- Reconnect mit gültigem, **aktivem** (`status='active'`, D24) Token stellt die Sitzung ohne erneuten Join wieder her
- DM kann ein Token per Kick invalidieren — danach ist Reconnect nur über neuen Join möglich
- Abgelaufene/invalidierte Tokens → klare Meldung, Rückkehr zum Join-Screen
- Token wird nie an andere Clients ausgeliefert, nie geloggt
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API

---

## Story Tracking

> **⚠️ Wahrheit = GitHub, nicht diese Tabelle.** Diese Tabelle driftet (Issues werden nicht sauber zurückgetrackt) — für den echten open/closed-Stand **immer GitHub** abfragen (`gh issue list --label "area: multiplayer" --state open`). Die Tabelle ist nur grobe Orientierung.
> **Rebuild-Set (frisch, nach Reset #348).** Alte Story-Nummern (#195–#204, #322/#323, #332–#338, #299-alt) = **überholt** (Alt-Modell). Regressions-Fixes (2026-08-25) laufen als **eigene Änderungs-Issues** gegen die closed Rebuild-Stories.

| Story | ID | Prio | Blocked by | Titel |
|---|---|---|---|---|
| **Reset** | **#348** | p0 | — | **Gesamte M10-Implementierung entfernen** → sauberer Neuaufbau (zuerst) |
| M10-S20 | #349 | p0 | #152 | Campaign-Klammer + `campaign_id`-Keying (Foundation, D23) |
| M10-S01 | #350 | p0 | #152 | WebRTC-Transport & Host-Lebenszyklus (DataChannel, kein Server) |
| M10-S02 | #351 | p0 | S20+S01 | Campaign-Identität, Einladungscodes & Token-Auth (**Auto-Join** D24) |
| M10-S03 | #352 | p0 | S20+S02 | Spieler-Mitgliedschaft — Schema & Services (campaign-scoped) |
| M10-S04 | #353 | p1 | S20+S03 | Spieler-Gruppen (campaign-scoped) |
| M10-S22 | #342 | p0 | Reset | **App-Mode-Shell (D25):** Toggle + Mode/Rolle/Session-Kontext + Menü-Reduktion |
| M10-S23 | #346 | p0 | S22 | **Read-only Player-Gating (D25)** |
| M10-S05 | #354 | p0 | S01+S02+S22 | **Campaign beitreten** (Spieler-Modus, Auto-Join D24) |
| M10-S06 | #355 | p0 | S01+S02+S03+S22 | GM-Lobby — verbundene Spieler + Kick + Copy-Code (D27) |
| M10-S24 | #347 | p1 | S20 | Campaign-Mitglieder-Panel (persistente Roster-Verwaltung) |
| M10-S07 | #356 | p0 | S03+S04 | Per-Spieler/Gruppen-Visibility |
| M10-S08 | #357 | p1 | S05 | Spieler-Charaktererstellung + Bogen als Aktionsquelle (D13) |
| M10-S09 | #358 | p0 | S07+S01 | Spieler-Live-Sicht (host-gefilterte Inhalte) |
| M10-S10 | #359 | p1 | S02+S05 | Reconnect & Token-Persistenz |
| M10-S14 | #360 | p1 | S05+S06+S22 | Play-Cockpit: Reiter Map/Kampflog/Spotlight + Free-Browse (D13) |
| M10-S15 | #361 | p1 | S01+S07 | Spotlight/Whiteboard — gemeinsam + per-Spieler privat (D19) |
| M10-S16 | #362 | p1 | S01+S14 | Würfel-Roller + per-Wurf-Sichtbarkeit → Kampflog (D17) |
| M10-S17 | #363 | p1 | S01+S20 | Session-Zeit + Kalender-Gate (D16) — ✅ voranschreiten **+** absolut setzen |
| M10-S19 | #364 | p2 | — | In-App Split-View (D21) — ✅ nur In-App, kein Pop-out |
| M10-S21 | #365 | p1 | S20 | Campaign-Override + Promote (D23) — ✅ ganze Entity, reversibel |
| M10-Token | #366 | p1 | S01 | Token-Bewegung (D18) — ✅ V1 offen, kein Lock |
| M10-S11 | #367 | p2 | S01 | **Stufe 3:** WebRTC + STUN + Gratis-Broker (D28) · `needs-design` (nur Broker-Wahl) |
| M10-S12 | #368 | p2 | S01+S11 | **Stufe 3:** Broker-Signaling + manueller Fallback (D28) · `needs-design` (nur Broker-Wahl) |
| Sub-Epic | — | — | M9+M10 | **Kampf-Engine** → `planning/epics/M10b-combat-engine.md` · `needs-design` |

## Implementierungs-Reihenfolge (verbindlich, rekursiv aufgelöst)

**Phase 0 — Reset:** **#348** gesamte M10-Implementierung entfernen. **Zuerst**, schafft die saubere Grundlage.

**Phase 1 — Foundation (parallel baubar, nach Reset):**
- **S22 #342** App-Mode-Shell (Toggle + `AppModeContext` + Menü-Reduktion, D25) · p0 — *ohne sie ist der Play-Mode nicht erreichbar*
- **S23 #346** Read-only Player-Gating (D25) · p0 — *braucht S22-Kontext*
- **S20 #349** Campaign-Klammer + `campaign_id`-Keying (Datenmodell-Basis, D23) · p0
- **S01 #350** WebRTC-Transport + Host-Lebenszyklus (DataChannel, kein Server) · p0 — *parallel zu S20*
- **S02 #351** Campaign-Identität, Codes, Token-Auth (Auto-Join) · p0 — *braucht S20+S01*
- **S03 #352** Spieler-Mitgliedschaft (campaign-scoped) · p0 · **S04 #353** Gruppen · p1

**Phase 2 — Multiplayer-Kern:**
- **S05 #354** Campaign beitreten (braucht S01+S02+S22) · **S06 #355** GM-Lobby (braucht S01+S02+S03+S22)
- **S24 #347** Campaign-Mitglieder-Panel (braucht S20) · **S07 #356** Visibility (braucht S03+S04)

**Phase 3 — Play:**
- **S08 #357** Charaktererstellung (braucht S05) · **S09 #358** Live-Sicht (braucht S07+S01) · **S10 #359** Reconnect
- **S14 #360** Play-Cockpit (braucht S05+S06+S22) · **S15 #361** Whiteboard · **S16 #362** Würfel · **S17 #363** Session-Zeit · **#366** Token-Bewegung · **S19 #364** Split-View
- **S21 #365** Override-Default + Promote (braucht S20) — Authoring-seitig, parallel

**Phase 4 — Später:** Stufe 3 (**S11 #367** / **S12 #368**, braucht S01, `needs-design` Signaling), **Kampf-Sub-Epic** (`M10b`), Campaign-Log-UI (Aggregation, kein eigenes Objekt).

**Achse (kritischer Pfad):** `Reset #348 → (S22 ∥ S20 ∥ S01→S02→S03) → (S05 + S06) → S08 → Play-Features`.

## Abhängigkeiten

- **#152 (M8-S01) Session-Schema** — ✅ **geschlossen**. Fundament frei für S01/S02.
- **#154 (M8-S03) Play-Mode Screen** — ✅ **geschlossen**. S05/S06 daher nur noch auf S01/S02 gated (Labels ggf. entstale-blocken, sobald S01/S02 gebaut).
- **#166 (M9-S03) Player Character Schema** — ✅ **geschlossen**. S08 nur noch auf S05 gated.
- **#156 (M8-S04) Cross-Session World State** — verwandtes, aber getrenntes Konzept (siehe Decision 7). Kein Blocker, aber Datenmodell koordinieren.

## Wirkung auf bestehende Stories

- **#160 (M8-S08) Character-Panel** geht von "Spieler-Name als reiner Freitext, keine Identität" aus. Mit session-scoped Spieler-Identität (Decision 3) ändert sich die Annahme. → `status: blocked`, Verweis auf dieses Epic, damit das Character-Panel nicht auf eine veraltete Annahme hin implementiert wird.
