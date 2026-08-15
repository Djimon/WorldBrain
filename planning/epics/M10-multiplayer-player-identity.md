# EPIC-016: Multiplayer & Player Identity

## Goal

Spieler verbinden sich von **eigenen Geräten im selben WLAN** mit einer vom DM gehosteten Session,
erstellen einen Charakter auf Basis des Session-Regelwerks und sehen ausschließlich die Inhalte, die
der DM gezielt mit ihnen (oder ihrer Gruppe) geteilt hat. Sichtbarkeit wird von binär
(`public/gm_only/player_known/hidden_until_condition`) auf **pro Spieler / pro Gruppe** verfeinert.

Grundlage: Handover `docs/handover-player-identity.md` (2026-06-30).

## Architektur-Stufe

> ⚠️ **REALITÄT 2026-08 (überschreibt die „Stufe"-Historie unten):** Gebauter Transport = **WebRTC-DataChannel**
> (`webrtc-transport.ts`, Host-PC = Peer). **Es gibt KEINEN Rust-HTTP/WS-Server** (`src-tauri` hat keine
> Server-Deps). Ziel (User): **Spieler verbinden sich mit dem Host des DMs, lokal testbar.** WebRTC erfüllt das
> — lokal via **Loopback/Same-Machine-Peer** (= D26 GM-Self-Join), remote via STUN. Die „Stufe 2 = Rust-LAN-Server"-
> Formulierung ist damit **überholt**; das Transport-Interface bleibt (Renderer redet gegen Transport, egal welcher).
> **Konsequenz für S01:** dessen AC „Rust-Server + LAN-bind" ist obsolet — der reale offene Punkt ist „lokal
> testbarer WebRTC-Host + automatisches Loopback-Signaling" (siehe unten), nicht ein Rust-Server.
> **Lokales Testen braucht automatisches Signaling** (Same-Machine/Loopback ohne manuelles Copy-Paste) — die
> manuelle Offer/Answer-UI (SignalingPanel, S12) ist nur für den Internet-Fall, nie lokal.

**Stufe 2 — Lokaler LAN-Server (überholt, siehe Banner).** Die Tauri-App hostet einen kleinen HTTP/WebSocket-Server im
eigenen Prozess (Rust, eingebettet). Spieler verbinden vom eigenen Handy/Laptop im selben WLAN.

- **Stufe 1** (mehrere Fenster auf der GM-Maschine) ist verworfen — Geheimnis-Leak über geteilten Bildschirm nicht verhinderbar.
- **Stufe 3** (Internet/Relay/NAT-Traversal) ist **out of scope**, aber die Transport-Schicht wird abstrahiert, damit Stufe 3 später ohne Service-Rewrite ergänzt werden kann. **Research zu Stufe 3 (Host-PC = Server, ohne eigene Infrastruktur): `planning/research/multiplayer-internet-hosting.md`** — bestätigt: Listen-Server-Modell, NAT-Traversal via STUN gratis (Anwender konfiguriert nichts), coturn-TURN nur als Minderheiten-Fallback (Cent-VPS). **EOS ist für ein Nicht-Video-Game laut ToS raus** → lizenzfreier WebRTC/STUN-Weg. LAN (Stufe 2) bleibt als Dev-Vehikel + Fallback, nicht skippen.

  **Konkreter Stufe-3-Plan (Reihenfolge: erst LAN/Stufe 2, dann):** **M10-S11 (#322)** WebRTC-DataChannel-Transport + STUN (Host-PC = Peer, Anwender konfiguriert nichts) und **M10-S12 (#323)** serverloses Signaling (Connection-Code-Austausch). **Bewusst NICHT in V1:** TURN/coturn-Relay (self-hosted Infra — daher scheitern ~10–20 % symmetrische NATs mit klarer Meldung) und ein gehosteter Signaling-Server (Signaling ist manuell/copy-paste). Beide sind hinter Interfaces vorgesehen, später ohne Rewrite nachrüstbar. Blocked ← #195 (Transport-Abstraktion aus S01).

## Decisions

1. **Transport abstrahiert:** Eingebetteter LAN-Server (HTTP/WS) hinter einem Transport-Interface. Server-Lebenszyklus an die aktive Session gekoppelt (Start beim Session-Hosting, Stop beim Schließen). Stufe 3 = austauschbarer Transport, kein Rewrite.
2. **Session als einziger Multiplayer-Anker:** Das Multi-Player-Konstrukt existiert nur innerhalb einer Session. DM erstellt die Session (→ M8-S01 #152). Session erhält GUID + Hash + generierten Einladungscode.
3. **Spieler-Identität ist session-scoped, kein globaler Account:** Ein "Player" ist eine Mitgliedschaft (`session_id + player_id + token`). Der globale Spieler-Name bleibt Freitext (#160) — echte Identität entsteht erst beim Session-Join.
4. **Join-Flow (⚠️ überschrieben durch D24 — Auto-Join):** ~~DM erstellt Session → Einladungscode → Spieler gibt Code ein → `pending` → DM bestätigt (`approved`) → …~~ **Neu (D24):** DM erstellt Session → **einen** Einladungscode/-Link → Spieler gibt Code ein → **sofort aktives Mitglied** (kein Approve-Gate) → Charaktererstellung (→ M9-S03 #166) → sieht freigegebene Inhalte. Einziger nachträglicher Gate: **DM-Kick**.
5. **Default-Sichtbarkeit in einer Session: alles `gm_only`.** Der Spieler sieht nach dem Join zunächst nichts außer dem, was der DM explizit freigibt. Freigabe (Lore-Texte, Bilder/Concept-Art) läuft über das bestehende Visibility-System.
6. **Per-Spieler/Gruppen-Visibility ist additiv, nicht ersetzend:** Die 4 bestehenden Scopes (#53, #81) bleiben. `player_known` wird um eine Targeting-Ebene verfeinert: an welche Spieler / welche Gruppen. Neue Tabelle `session_visibility_overrides`, keine Erweiterung von `campaign_entity_overrides`.
7. **Abgrenzung zu Cross-Session World State (#156 / M8-S04):** Getrenntes Konzept. Per-Spieler-Visibility = *wer sieht was in einer laufenden Session*. Cross-Session World State = *was wird über Weltzeit in die globale Lore zurückgeschrieben* (DM-gesteuerter Promote-Schritt). Kein gemeinsames Datenmodell, aber kein Widerspruch: Visibility-Overrides sind session-scoped, World-State-Promotes sind global/weltzeit-scoped.
8. **Sicherheit ist Kernanforderung, kein Nebenaspekt:** Das gesamte Feature existiert, um Geheimnis-Leaks zu verhindern. Server-seitige Durchsetzung (`gm_only` by default), token-basierte Auth, keine Auslieferung nicht-freigegebener Inhalte an den Client.

## Detail-Spec (Grill-Session 2026-08) — Decisions 9–22

Vollständige Durchspecc-Session (grill-me). Diese Decisions verfeinern/ergänzen 1–8.

- **D9 — Player-Auslieferung = Hybrid, EINE Web-UI-Codebasis.** Die Player-UI ist Web-Tech, ausgeliefert auf zwei Wegen: (a) **vom Host-Server serviert → Browser-Join** (Handy/Laptop im WLAN, kein Install); (b) **eingebettet als „Player-Modus" derselben Tauri-App** (Desktop, mit gespeichertem Dashboard). **Keine separate Player-.exe** (wäre nicht leichtgewichtig — braucht denselben View-Stack). Datenquelle immer = Host-API, nie lokale DB.
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
- **D20 — Transport + Live-Kanäle.** Eingebetteter **HTTP-Server** serviert die Player-Web-UI + Initial-Loads; **WebSocket** für bidirektionalen Live-Push. **Live gepusht:** Freigaben (S09), Token-Bewegungen (D18), Spotlight/Whiteboard (D19), Kampflog-Einträge (D17/Kampf), Session-Zeit/Kalender-Gate (D16). Eigener Charakterbogen lokal live editierbar; fremde Bögen nicht sichtbar. **Server-durchgesetzt:** Visibility (S09), Wurf-Sichtbarkeit (D17), Whiteboard-Privatheit (D19), Fog (nur aufgedeckt), Kalender-Gate (D16). **Kein Rate-Limit in V1** (Spieler read-only, DM kickt jederzeit — nichts Kritisches).
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

## Nachschärfung 2026-08-15 (Live-Test-Feedback) — Decisions 24–27

Live-Test der gemounteten Multiplayer-UI zeigte: das Approve-Gate-Modell und die geleakte Stufe-3-Signaling-UI entsprechen **nicht** dem gewünschten Ablauf. Korrektur:

- **D24 — Auto-Join, KEIN Approve-Gate (überschreibt Decision 4).** Der DM erzeugt **einen** Einladungscode/-Link. **Wer den Code benutzt, ist sofort aktives Mitglied** — kein `pending`, kein Bestätigen/Ablehnen durch den DM. Der einzige Gate ist **nachträglich**: der DM kann jederzeit **kicken** (invalidiert dessen Token), und **Code-neu-generieren** invalidiert den alten Code für *neue* Joins (bestehende Spieler behalten ihr Token → Reconnect D11). Konsequenz: `session_players.invite_status` verliert `pending`/`rejected`; ein Join legt direkt einen aktiven Eintrag an. `rejected`/Fehler nur noch bei **ungültigem Code / Server nicht erreichbar**, nicht durch DM-Entscheidung. **Wo D9–D22, S02, S05, S06 „`pending`/`approved`/`approve`" sagen, gilt D24.**
- **D25 — Ein Programm, zwei Modi + globaler Top-Bar-Toggle.** Dieselbe .exe läuft entweder im **Edit-Mode** (Worldbuilding) oder im **Play-Mode** (Session-Cockpit). Ein **globaler, immer sichtbarer Umschalter in der Top-Bar** („Bearbeiten ⟷ Spielen") flippt den **ganzen Workspace** — kein Seitenleisten-Icon, kein pro-Session-Schalter. Der **Player-Modus ist derselbe Build** (Spieler-Einstieg der Tauri-App), kein zweiter .exe. **Browser-Join (D9-Variante a) wird auf eine spätere Stufe verschoben** — jetzt zuerst nur App-Player-Modus + GM-Self-Join (D26). D9 bleibt als End-Ziel gültig, Reihenfolge: App-Modus zuerst.
- **D26 — GM-Self-Join.** Ein Anwender, der zugleich DM **und** Spieler ist, muss mit **derselben Host-App** als Spieler beitreten können: die App verbindet gegen den **eigenen laufenden Server (loopback)** und öffnet eine Spieler-Sicht. Ein Gerät = hosten **und** einen eigenen Charakter spielen. Kein zweites Gerät, kein zweiter Build nötig.
- **D27 — Copy-UX für Einladungscode/-Link (Standard).** Der Code steht in einem **gesperrten (readonly) Input-Feld** mit **Copy-Button** (Klick kopiert in die Zwischenablage, sichtbares Feedback „kopiert") — **nicht** als nacktes Text-Element. Zusätzlich ein teilbarer **Einladungs-Link** (Server-URL + Code kombiniert) mit eigenem Copy-Button. Kein WebRTC-„Antwort-Code"-Rückkanal in Stufe 2 — die manuelle Offer/Answer-Signaling-UI (SignalingPanel, S12) erscheint **ausschließlich** in der Stufe-3-Sicht, **nie** in der LAN-Lobby.

### Offene Detailfragen (als `needs-decision` in den jeweiligen Stories)
- Session-Jetzt **absolut setzbar** (nicht nur vorstellen)? → S17.
- Optionaler **Token-Lock** (per-Token/global) — Rechte-Modell? → S18/#299.
- Öffentlicher vs. privater **Kampfzustand** (was sehen andere von fremder HP/Status?) → Combat-Sub-Epic.

## Out of Scope

- ~~Stufe 3: Internet-Hosting, Relay-Server, NAT-Traversal~~ **korrigiert 2026-08:** WebRTC-DataChannel + STUN (NAT-Traversal) sind **IN scope und gebaut** (S11/S12). Weiterhin **out of scope:** TURN/coturn-Relay (self-hosted Infra) und ein **gehosteter** Signaling-Server (Signaling bleibt manuell/copy-paste bzw. lokal automatisch).
- Echtzeit-Kollaboration mehrerer GMs
- Cloud-Accounts / globale Spieler-Identität über Sessions hinweg
- Cross-Session World State (eigenes Konzept, #156)
- Voice/Video/Chat
- Verschlüsselter Transport über Stufe 2 hinaus (LAN-Vertrauensmodell; TLS-Härtung = spätere Stufe)

## Stories

### M10-S01: Lokaler Session-Server & Transport-Abstraktion

**Ziel:** Die App hostet beim Session-Start einen lokalen HTTP/WS-Server hinter einem austauschbaren Transport-Interface.

**AC:**
- Rust-seitiger, in den Tauri-Prozess eingebetteter HTTP/WebSocket-Server, start-/stoppbar via Tauri-Command
- Server startet beim Hosting einer Session, stoppt beim Schließen — kein offener Port ohne aktive Session
- Transport-Interface (TypeScript) kapselt Senden/Empfangen, sodass Stufe 3 (Relay) später ohne Service-Rewrite ergänzbar ist
- Server bindet nur an LAN-Interface, zeigt dem DM die erreichbare URL/IP + Port an
- Alle eingehenden Nachrichten werden server-seitig validiert (Schema-Check) bevor Verarbeitung — kein ungeprüftes Payload
- Blocked by #152 (Session-Schema & Persistenz)
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

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

### M10-S05: Player-Join-Flow (Spieler-Modus-Client) — **AUTO-JOIN (D24)**

**Ziel:** Ein Spieler gibt Server-URL + Einladungscode + Anzeigenamen ein und ist **sofort drin** — kein Warten auf Bestätigung.

**AC (D24/D25/D26):**
- Spieler-Modus-Einstieg (**derselbe Build**, D25): Eingabe Server-URL + Einladungscode + Anzeigename.
- Nach Absenden mit **gültigem** Code: **sofort aktives Mitglied**, direkter Übergang zur Charaktererstellung (→ M10-S08). **Kein `pending`-Zustand, kein „Warte auf Bestätigung".**
- Fehlerfall NUR bei **ungültigem Code** oder **Server nicht erreichbar** (klare Meldung) — **nie** eine DM-Ablehnung.
- **GM-Self-Join (D26):** derselbe Einstieg akzeptiert die **loopback/eigene** Server-URL, sodass der Host als Spieler beitritt.
- **UI-Basics:** Eingaben als `Field`, Beitreten als `Button` (`accent`), Fehler als `StatusChip` (`failure`), Form in `Panel` — aus `src/ui/primitives.tsx`, kein nacktes HTML.
- Verbindungsabbruch wird angezeigt, automatischer Reconnect-Versuch mit gespeichertem Token (→ M10-S10, kein Neu-Join).
- Blocked by #154 (Play-Mode Screen) — **geschlossen**; realer Gate = S01/S02.
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API.
- `database`/Service prop typed as `DatabaseLike`; no `unknown`/`as never`.

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

### M10-S22: Globaler Create↔Play-Toggle in der Top-Bar (D25)

**Ziel:** Ein **immer sichtbarer** Umschalter in der Kopfzeile flippt den **ganzen Workspace** zwischen **Bearbeiten** (Worldbuilding) und **Spielen** (Session-Cockpit). Ohne ihn ist der Play-Mode für den Nutzer nicht auffindbar (5× reklamiert).

**WIE — mechanisch, kein Interpretationsspielraum:**
- **Mount-Punkt (benannt):** Der Toggle wird in der **Top-Bar/Kopfzeile von `src/ui/WorkspaceShell.tsx`** gerendert — nicht in der Seitenleiste, nicht in einem Area-Icon, nicht in `PlayModeView`. Er ist in **beiden** Modi sichtbar.
- **Zustand:** `WorkspaceShell` hält einen Modus-State `mode: 'edit' | 'play'` (Default `'edit'`). Der Toggle schaltet ihn um. Beschriftung: `t('modeEdit','Bearbeiten')` ⟷ `t('modePlay','Spielen')`, aktueller Modus visuell markiert (`aria-pressed`/`aria-selected`).
- **Wirkung:** Bei `mode === 'play'` rendert der Haupt-Content-Bereich das **Play-Mode-Cockpit** (`PlayModeView`, role `dm`); bei `mode === 'edit'` das bestehende Worldbuilding (Entities/Karten/Kalender). Der Umschalter ersetzt den bisherigen 🎲-`'session'`-Area-Eintrag als *primären* Zugang (Area-Eintrag darf bleiben, ist aber nicht mehr der einzige Weg).
- **Kein prop-drilling-Bruch:** `database`/`sessionId` werden wie beim bisherigen `'session'`-Case an `PlayModeView` durchgereicht.

**AC:**
- Toggle-Element mit `data-testid="mode-toggle"` in der `WorkspaceShell`-Kopfzeile, in beiden Modi sichtbar.
- Klick auf „Spielen" → `PlayModeView` (role `dm`) erscheint im Hauptbereich; Klick auf „Bearbeiten" → Worldbuilding-Ansicht zurück.
- Der aktive Modus ist visuell erkennbar (`aria-pressed`/`aria-selected` gesetzt).
- Keine hardcodierten Strings — `useTranslation` + Inline-Default.
- **Integrationstest durch den echten Mount (Pflicht, AGENTS.md:80):** rendert `WorkspaceShell` (nicht `PlayModeView` isoliert), klickt `mode-toggle`, erwartet echten `PlayModeView`-Inhalt (z.B. `data-testid="dm-cockpit"`), klickt zurück, erwartet Worldbuilding-Ansicht. Guard: `<PlayModeView` wird durch `WorkspaceShell` erreicht (grep zeigt Mount außerhalb der eigenen Datei/Tests).
- `database` prop typed as `DatabaseLike`; no `unknown`/`as never`.
- **UI-Basics:** Segmented-Control aus zwei `Button`s (aktiv `accent`+`aria-pressed`, inaktiv `neutral`), in die bestehende Top-Bar eingepasst — aus `src/ui/primitives.tsx`, kein nacktes `<button>`.

**Out of scope:** Player-Modus-Einstieg (S05), Cockpit-Inhalte selbst (S14 ff.).

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
- Erstellter Charakter wird als Entity mit `is_player_character: true` angelegt und dem Spieler (`player_id`) zugeordnet
- Spieler kann nur seinen eigenen Charakter bearbeiten, nicht fremde
- Blocked by #166 (Player Character Schema & UI)
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

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

| Story | ID | Prio | Blocked by | Titel |
|---|---|---|---|---|
| M10-S01 | #195 | p0 | #152 | Lokaler Session-Server & Transport-Abstraktion |
| M10-S02 | #196 | p0 | #152 | Session-Identität, Einladungscodes & Token-Auth |
| M10-S03 | #197 | p0 | — | Spieler-Mitgliedschaft — Schema & Services |
| M10-S04 | #198 | p1 | — | Spieler-Gruppen |
| M10-S05 | #199 | p0 | S01+S02 | **Player-Client (Hybrid) + gespeichertes Player-„Projekt"** — geschärft, absorbiert Hybrid-Auslieferung (D9/D10) |
| M10-S06 | #200 | p0 | S01+S02 | GM-Lobby: Verbundene Spieler + Kick + **Copy-Code (D27)**, **kein Approve (D24)** |
| M10-S22 | #342 | p0 | — | **Globaler Create↔Play-Toggle in der Top-Bar (D25)** — Workspace-Modus-Umschalter |
| Bug | #340 | p0 | S05/S06 | **Auto-Join statt Approve-Gate (D24) + GM-Self-Join (D26)** — korrigiert closed #196/#199/#200 |
| Bug | #341 | p1 | S06 | **Copy-Code-Feld+Button (D27) + Signaling raus aus LAN-Lobby** |
| M10-S07 | #201 | p0 | — | Per-Spieler/Gruppen-Visibility |
| M10-S08 | #202 | p1 | S05 | Spieler-Charaktererstellung + Bogen als Aktionsquelle (D13) |
| M10-S09 | #203 | p0 | — | Spieler-Live-Sicht (gefilterte Inhalte) ✅ |
| M10-S10 | #204 | p1 | — | Reconnect & Token-Persistenz ✅ |
| M10-S14 | #332 | p1 | S05/S06 | **Play-Hauptfeld: Reiter Map/Kampflog/Spotlight + Free-Browse** (D13/D21) |
| M10-S15 | #333 | p1 | S01/S07 | **Spotlight/Whiteboard** — gemeinsam + per-Spieler privat (D19) |
| M10-S16 | #334 | p1 | S01 | **Würfel-Roller + per-Wurf-Sichtbarkeit** → Kampflog (D17) |
| M10-S17 | #335 | p1 | S01 | **Session-Zeit + server-seitiges Kalender-Gate** (D16) · `needs-decision` (absolut setzen?) |
| M10-S19 | #336 | p2 | — | **In-App Split-View** (D21) · `needs-decision` (OS-Pop-out später) |
| M10-S11 | #322 | p2 | #195 | **Stufe 3:** Internet-Transport via WebRTC-DataChannel + STUN (ohne TURN) |
| M10-S12 | #323 | p2 | #195 | **Stufe 3:** Serverloses Signaling — Connection-Code-Austausch (kein Hosted-Server) |
| #299 | #299 | p1 | S01 | Token-Bewegung: **Default offen (D18)**, optionaler Lock später · `needs-decision` |
| M10-S20 | #337 | p0 | — | **Campaign-Klammer + `campaign_id`-Keying** (Foundation, D23) |
| M10-S21 | #338 | p1 | S20 | **Campaign-Override-Default + Promote-Schalter** (D23) · `needs-decision` |
| Sub-Epic | — | — | M9+M10 | **Kampf-Engine** → `planning/epics/M10b-combat-engine.md` · `needs-design` (eigene Grill-Runde offen) |

## Implementierungs-Reihenfolge (verbindlich, rekursiv aufgelöst)

**Phase 0 — Foundation (parallel baubar):**
- **S22 #342** Globaler Create↔Play-Toggle in der Top-Bar (D25) · p0 — *reine UI-Shell, unabhängig; ohne ihn ist der Play-Mode gar nicht erreichbar → zuerst*
- **S20 #337** Campaign-Klammer + `campaign_id`-Keying (Datenmodell-Basis für Roster/Overrides/Visibility, D23) · p0
- **S01 #195** lokaler Server + Transport (HTTP serviert Player-UI + WS-Live) · p0 — *unabhängig von S20, parallel*
- **S02 #196** Session-Identität, Codes, Token-Auth · p0

**Phase 1 — Multiplayer-Kern (braucht S20 + S01 + S02):**
- **S05 #199** Player-Client (Hybrid) + gespeichertes Player-Projekt
- **S06 #200** GM-Lobby: verbundene Spieler + Kick + Copy-Code (D27), **kein Approve** (Roster/Gruppen campaign-scoped aus S20)
- **Korrektur-Bugs (P0/P1, gegen die schon gebauten, closed Stories):** **#340** Auto-Join statt Approve-Gate (D24) + GM-Self-Join (D26) · **#341** Copy-Code-Feld+Button (D27) + Signaling raus aus LAN-Lobby. Diese bringen das gemountete Verhalten auf D24–D27.

**Phase 2 — Play:**
- **S08 #202** Charaktererstellung (braucht S05)
- **S14 #332** Play-Hauptfeld (Reiter Map/Kampflog/Spotlight, braucht S05/S06)
- **S15 #333** Whiteboard · **S16 #334** Würfel · **S17 #335** Session-Zeit/Kalender-Gate · **#299** Token-Bewegung · **S19 #336** Split-View
- **S21 #338** Campaign-Override-Default + Promote (braucht S20) — Authoring-seitig, parallel

**Phase 3 — Später:** Stufe 3 (S11 #322 / S12 #323, braucht S01), **Kampf-Sub-Epic** (`M10b`, braucht M9-Substrat), Campaign-Log-UI (Aggregation, kein eigenes Objekt).

**Achse (kritischer Pfad):** `(S20 ∥ S01→S02) → (S05 + S06) → S08 → Play-Features`.

## Abhängigkeiten

- **#152 (M8-S01) Session-Schema** — ✅ **geschlossen**. Fundament frei für S01/S02.
- **#154 (M8-S03) Play-Mode Screen** — ✅ **geschlossen**. S05/S06 daher nur noch auf S01/S02 gated (Labels ggf. entstale-blocken, sobald S01/S02 gebaut).
- **#166 (M9-S03) Player Character Schema** — ✅ **geschlossen**. S08 nur noch auf S05 gated.
- **#156 (M8-S04) Cross-Session World State** — verwandtes, aber getrenntes Konzept (siehe Decision 7). Kein Blocker, aber Datenmodell koordinieren.

## Wirkung auf bestehende Stories

- **#160 (M8-S08) Character-Panel** geht von "Spieler-Name als reiner Freitext, keine Identität" aus. Mit session-scoped Spieler-Identität (Decision 3) ändert sich die Annahme. → `status: blocked`, Verweis auf dieses Epic, damit das Character-Panel nicht auf eine veraltete Annahme hin implementiert wird.
