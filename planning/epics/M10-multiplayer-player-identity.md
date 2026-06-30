# EPIC-016: Multiplayer & Player Identity

## Goal

Spieler verbinden sich von **eigenen Geräten im selben WLAN** mit einer vom DM gehosteten Session,
erstellen einen Charakter auf Basis des Session-Regelwerks und sehen ausschließlich die Inhalte, die
der DM gezielt mit ihnen (oder ihrer Gruppe) geteilt hat. Sichtbarkeit wird von binär
(`public/gm_only/player_known/hidden_until_condition`) auf **pro Spieler / pro Gruppe** verfeinert.

Grundlage: Handover `docs/handover-player-identity.md` (2026-06-30).

## Architektur-Stufe

**Stufe 2 — Lokaler LAN-Server.** Die Tauri-App hostet einen kleinen HTTP/WebSocket-Server im
eigenen Prozess (Rust, eingebettet). Spieler verbinden vom eigenen Handy/Laptop im selben WLAN.

- **Stufe 1** (mehrere Fenster auf der GM-Maschine) ist verworfen — Geheimnis-Leak über geteilten Bildschirm nicht verhinderbar.
- **Stufe 3** (Internet/Relay/NAT-Traversal) ist **out of scope**, aber die Transport-Schicht wird abstrahiert, damit Stufe 3 später ohne Service-Rewrite ergänzt werden kann.

## Decisions

1. **Transport abstrahiert:** Eingebetteter LAN-Server (HTTP/WS) hinter einem Transport-Interface. Server-Lebenszyklus an die aktive Session gekoppelt (Start beim Session-Hosting, Stop beim Schließen). Stufe 3 = austauschbarer Transport, kein Rewrite.
2. **Session als einziger Multiplayer-Anker:** Das Multi-Player-Konstrukt existiert nur innerhalb einer Session. DM erstellt die Session (→ M8-S01 #152). Session erhält GUID + Hash + generierten Einladungscode.
3. **Spieler-Identität ist session-scoped, kein globaler Account:** Ein "Player" ist eine Mitgliedschaft (`session_id + player_id + token`). Der globale Spieler-Name bleibt Freitext (#160) — echte Identität entsteht erst beim Session-Join.
4. **Join-Flow:** DM erstellt Session → Einladungscode → Spieler gibt Code im Spieler-Modus ein → Anfrage landet beim DM als `pending` → DM bestätigt (`approved`) → Spieler erstellt Charakter auf Basis des Session-System-Plugins (→ M9-S03 #166) → Spieler sieht freigegebene Inhalte.
5. **Default-Sichtbarkeit in einer Session: alles `gm_only`.** Der Spieler sieht nach dem Join zunächst nichts außer dem, was der DM explizit freigibt. Freigabe (Lore-Texte, Bilder/Concept-Art) läuft über das bestehende Visibility-System.
6. **Per-Spieler/Gruppen-Visibility ist additiv, nicht ersetzend:** Die 4 bestehenden Scopes (#53, #81) bleiben. `player_known` wird um eine Targeting-Ebene verfeinert: an welche Spieler / welche Gruppen. Neue Tabelle `session_visibility_overrides`, keine Erweiterung von `campaign_entity_overrides`.
7. **Abgrenzung zu Cross-Session World State (#156 / M8-S04):** Getrenntes Konzept. Per-Spieler-Visibility = *wer sieht was in einer laufenden Session*. Cross-Session World State = *was wird über Weltzeit in die globale Lore zurückgeschrieben* (DM-gesteuerter Promote-Schritt). Kein gemeinsames Datenmodell, aber kein Widerspruch: Visibility-Overrides sind session-scoped, World-State-Promotes sind global/weltzeit-scoped.
8. **Sicherheit ist Kernanforderung, kein Nebenaspekt:** Das gesamte Feature existiert, um Geheimnis-Leaks zu verhindern. Server-seitige Durchsetzung (`gm_only` by default), token-basierte Auth, keine Auslieferung nicht-freigegebener Inhalte an den Client.

## Out of Scope

- Stufe 3: Internet-Hosting, Relay-Server, NAT-Traversal
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
- Spieler-Join mit gültigem Code erzeugt ein Spieler-Token; Token wird server-seitig der Session-Mitgliedschaft zugeordnet
- Auth-Middleware: jede Server-Anfrage ohne gültiges, `approved` Token wird abgewiesen
- Einladungscode kryptografisch zufällig (`crypto.getRandomValues`/Rust-Äquivalent), nicht erratbar
- Tokens werden nie geloggt und nie an andere Spieler ausgeliefert
- Blocked by #152 (Session-Schema & Persistenz)
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M10-S03: Spieler-Mitgliedschaft — Schema & Services

**Ziel:** Spieler-Mitgliedschaften in einer Session sind persistiert und verwaltbar.

**AC:**
- Tabellen: `players` (id, display_name, created_at), `session_players` (session_id, player_id, token_hash, invite_status: `pending|approved|rejected|kicked`, joined_at)
- Service: createPlayer, requestJoin, approve, reject, kick, listSessionPlayers
- Nur `approved` Mitgliedschaften gelten als aktive Spieler
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

### M10-S05: Player-Join-Flow (Spieler-Modus-Client)

**Ziel:** Ein Spieler verbindet sich im Spieler-Modus per Einladungscode und wartet auf Bestätigung.

**AC:**
- Spieler-Modus-Einstieg: Eingabe von Server-URL + Einladungscode + eigenem Anzeigenamen
- Nach Absenden: Verbindungsaufbau, Status `pending` sichtbar ("Warte auf Bestätigung des Spielleiters")
- Bei `approved`: Übergang zur Charaktererstellung (→ M10-S08), bei `rejected`: klare Meldung
- Verbindungsabbruch wird dem Spieler angezeigt, automatischer Reconnect-Versuch (→ M10-S10)
- Kein Inhalt der Session wird vor `approved` an den Client ausgeliefert
- Blocked by #154 (Play-Mode Screen & Create↔Play-Toggle)
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API

---

### M10-S06: GM-Lobby & Approve-Management

**Ziel:** Der DM sieht Join-Anfragen, bestätigt/lehnt ab und verwaltet verbundene Spieler.

**AC:**
- Lobby-Panel im Play-Modus: Liste `pending` Anfragen mit Anzeigename + Zeitpunkt
- Aktionen: Approve, Reject, Kick (entfernt aktiven Spieler, invalidiert Token)
- Liste der `approved` Spieler mit Verbindungsstatus (online/offline)
- Zuordnung von Spielern zu Gruppen (→ M10-S04) direkt aus der Lobby
- Einladungscode anzeigen + neu generieren
- Blocked by #154 (Play-Mode Screen & GM-Whiteboard)
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

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

**Ziel:** Nach Bestätigung erstellt der Spieler einen Charakter auf Basis des Session-Regelwerks.

**AC:**
- Nach `approved`: Charaktererstellung auf Basis des `system_plugin_id` der Session (→ M9-S03 #166)
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

**Ziel:** Ein bestätigter Spieler kann nach Verbindungsabbruch ohne erneute Bestätigung zurückkehren.

**AC:**
- Spieler-Token wird lokal im Spieler-Client persistiert
- Reconnect mit gültigem, `approved` Token stellt die Sitzung ohne erneuten DM-Approve wieder her
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
| M10-S05 | #199 | p0 | #154 | Player-Join-Flow (Spieler-Modus-Client) |
| M10-S06 | #200 | p0 | #154 | GM-Lobby & Approve-Management |
| M10-S07 | #201 | p0 | — | Per-Spieler/Gruppen-Visibility |
| M10-S08 | #202 | p1 | #166 | Spieler-Charaktererstellung im Join-Flow |
| M10-S09 | #203 | p0 | — | Spieler-Live-Sicht (gefilterte Inhalte) |
| M10-S10 | #204 | p1 | — | Reconnect & Token-Persistenz |

## Abhängigkeiten

- **#152 (M8-S01) Session-Schema** — Fundament für "aktive Session" als Anker. Hartblocker für S01, S02.
- **#154 (M8-S03) Play-Mode Screen** — liefert den Create↔Play-Toggle und den Ort für Lobby/Join-UI. Hartblocker für S05, S06.
- **#166 (M9-S03) Player Character Schema** — Charaktererstellung im Join-Flow. Hartblocker für S08.
- **#156 (M8-S04) Cross-Session World State** — verwandtes, aber getrenntes Konzept (siehe Decision 7). Kein Blocker, aber Datenmodell koordinieren.

## Wirkung auf bestehende Stories

- **#160 (M8-S08) Character-Panel** geht von "Spieler-Name als reiner Freitext, keine Identität" aus. Mit session-scoped Spieler-Identität (Decision 3) ändert sich die Annahme. → `status: blocked`, Verweis auf dieses Epic, damit das Character-Panel nicht auf eine veraltete Annahme hin implementiert wird.
