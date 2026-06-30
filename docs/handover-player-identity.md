# Handover: Spieler-Identität & sitzungsbasierte Sichtbarkeit

Stand: 2026-06-30. Für Requirements-Engineering-Durchsprache, kein Implementierungsplan.

## Ausgangsproblem

Aktuell ist Sichtbarkeit (`visibility_json` auf Entities/Markern) binär: `public | gm_only | player_known | hidden_until_condition`. `player_known` meint "sichtbar für den (einen, geteilten) Player-Screen" — es gibt nur **eine** gemeinsame Spieler-Ansicht, keine Unterscheidung zwischen einzelnen Spielern oder Gruppen. Wunsch: GM soll Sichtbarkeit pro einzelnem Spieler oder pro Gruppe vergeben können, Spieler sollen sich dafür mit einer festen ID/Hash beim GM (Host) anmelden, GM bestätigt Einladungen.

## Befund: aktueller Code-Stand (verifiziert per Repo-Lesung)

- **Keine Netzwerk-Schicht.** Kein Server-Code in `src-tauri/`, keine Netzwerk-Dependencies in `package.json`. Player Screen ist als zweites Tauri-`WebviewWindow` im selben Prozess gedacht (`src/ui/PlayerScreen.tsx:56`, `new WebviewWindow('player-screen', { url: 'player.html' })`) — `player.html` existiert nicht, der Launcher ist ein nicht fertiggestellter Pfad.
- **`VisibilityContext`** (`src/services/visibility-service.ts:3-9`) kennt nur `audience: 'gm' | 'player'`, kein `session_id`, kein `player_id`, kein `group_id`. Aktuell fest verdrahtet in `WorkspaceShell.tsx:404`: `context={{ audience: 'gm' }}`.
- **Keine Player-/Gruppen-Tabellen** in der SQLite-Schema (`core_data/db-init.ts`, `core_data/session-schema.ts`). Kein `player_id`, `user_id`, `character_id` irgendwo.
- **`sessions`-Tabelle ist reine Metadaten-Ablage** (`id, title, world_time_start, notes, created_at`) — kein aktives-Session-Konzept im App-State, keine GM/Spieler-Rollenzuordnung.
- **`campaign_entity_overrides`** ist campagnen-weit (kein `session_id`-Feld), keine Session-Scoping-Mechanik vorhanden.
- **Kein Create-Mode/Play-Mode-Toggle** im UI — `WorkspaceShell` hat nur einen flachen `activeArea`-Switch zwischen Bereichen (Entities, Maps, Session, …), keine zwei getrennten App-Modi.

→ Das ist kein halbfertiges Feature, sondern eine echte, vollständige Lücke in Datenmodell, Service-Layer und UI.

## Relevante alte Epics (GitHub, Repo Djimon/WorldBrain)

| # | Titel | Status | Relevanz |
|---|---|---|---|
| #53 | M4-S05: Visibility system | CLOSED | Hat die 4 Scopes (`public/gm_only/player_known/hidden_until_condition`) definiert — **ohne** Per-Spieler/Gruppen-Granularität. Quelle der jetzigen binären Logik. |
| #81 | M5-S15: Marker visibility & condition gates | CLOSED | Hat Marker-spezifische Visibility + Condition-Gates gebracht, dito ohne Individual-Targeting. |
| #185 | MI-S05/S06: ConditionBuilder, PlayerScreen, … fehlen im WorkspaceShell | CLOSED | Hat PlayerScreen als GM-seitige Preview ins WorkspaceShell verdrahtet — **nicht** als eigenständiges Spieler-Fenster/-Gerät. |
| #152 | M8-S01: Session-Schema & Persistenz | **OPEN** | Definiert Sessions als vollständig persistierte Objekte (`sessions/<id>.json`, `active: true`-Flag, genau eine aktive Session). Das fehlende Fundament für "aktive Session" als App-State. |
| #153 | M8-S02: Session-Liste & Verwaltung | **OPEN** | GM kann Sessions anlegen/fortsetzen/archivieren — Voraussetzung dafür, dass es überhaupt einen Ort gibt, an dem Spieler "beitreten". |
| #154 | M8-S03: Play-Mode Screen & GM-Whiteboard | **OPEN** | Definiert den Create↔Play-Modus-Toggle, den es heute nicht gibt. Play-Mode-Screen mit Tool-Launcher (Encounter, Character-Panel, Session-Log, …). |
| #156 | M8-S04: Cross-Session World State | **OPEN** | Eigenes Konzept für sitzungsübergreifende Sichtbarkeit über Weltzeit — verwandt, aber orthogonal zu Per-Spieler-Visibility. Sollte beim Datenmodell mitgedacht werden, um keine zwei konkurrierenden Override-Mechanismen zu bauen. |
| #160 | M8-S08: Character-Panel | **OPEN** | `is_player_character: true`-Flag auf Entities, Feld "Spieler-Name" als **Freitext** — explizit **keine** Spieler-Identität/Account, nur ein Namensfeld. Wichtig: bestehender Plan sah nie ein Auth-Konzept vor. |
| #166 | M9-S03: Player Character Schema & UI | **OPEN** | System-Plugin-definiertes Charakterblatt — referenziert Charaktere, nicht Personen/Accounts. |
| #161 | M8-S09: Entity Session Notes | OPEN | Randrelevanz, nicht im Kernpfad. |

**Kernbefund:** In keinem bisherigen Epic (offen oder geschlossen) ist je eine Spieler-Identität, ein Invite-Flow oder eine GM-Host-Bestätigung vorgesehen gewesen. Das M8-Epic baut Session-Infrastruktur, bleibt aber explizit bei "Spieler-Name als Freitext" (#160) — das neue Feature ist ein eigenständiger Zusatz, kein Lückenschluss innerhalb eines bestehenden Epics.

## Blockaden / Abhängigkeiten

1. **#152 (Session-Schema) ist Vorbedingung.** Ohne persistente "aktive Session" mit `active: true`-Flag gibt es keinen Anker, an dem Spieler-Einladungen/-Mitgliedschaft hängen können.
2. **#154 (Play-Mode Screen)** liefert den Ort, an dem ein GM-Invite-Flow überhaupt UI-mäßig Sinn ergibt (Play-Mode statt Create-Mode).
3. **Netzwerk-Topologie ist unentschieden** (siehe Architektur-Frage unten) — entscheidet, ob ein Mini-Sync-Server, reines `localStorage`+Tauri-Window-IPC, oder von Anfang an ein echter lokaler Netzwerkserver gebaut wird. Das ist die größte Unbekannte und sollte zuerst mit dem Requirements Engineer geklärt werden, bevor Schema-Arbeit beginnt.
4. **Konflikt-Potenzial mit #156 (Cross-Session World State):** beide brauchen eine Art "Override-Schicht" über `campaign_entity_overrides` hinaus. Sollte nicht zweimal unabhängig gebaut werden — ein gemeinsames Scoping-Konzept (Session × Player/Gruppe × Weltzeit) ist sinnvoller als zwei Spezialtabellen.

## Grobe Idee (zur Diskussion, nicht final)

- Neue Tabellen: `players` (id, name, hash/token, created_at), `player_groups`, `player_group_members`, `session_players` (session_id, player_id, invite_status: pending/approved).
- Neue Override-Tabelle `session_visibility_overrides` (session_id, target_type, target_id, scope, player_id|group_id) statt Erweiterung von `campaign_entity_overrides`.
- Phasierung: (1) Schema + Services ohne UI, (2) Session-Modus als echter App-State (baut auf #152/#153 auf), (3) Mini-Sync-Server lokal (Transport austauschbar für späteres Netz-Hosting), (4) UI: Invite/Approve-Flow beim GM, Player-seitiger Join-Screen, erweiterter Visibility-Editor (Spieler/Gruppen-Auswahl statt binärem Dropdown).

## Offene Fragen für den Requirements Engineer

1. Topologie: separate Geräte im LAN (echter Server) vs. nur mehrere Fenster auf der GM-Maschine (kein Netzwerk nötig)?
2. ID-Vergabe: GM legt Spieler-Profile manuell an, vs. Spieler meldet sich selbst mit generiertem Hash an und GM bestätigt?
3. Verhältnis zu #156 (Cross-Session World State): ein gemeinsames Override-Datenmodell oder zwei getrennte?
4. Reihenfolge relativ zum offenen M8-Epic — wird Player-Identity Teil von M8, oder eigenständiges neues Epic (M10+)?
