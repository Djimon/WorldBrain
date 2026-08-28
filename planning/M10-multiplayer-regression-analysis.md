# M10 Multiplayer — Regression- & Root-Cause-Sammlung

**Stand:** 2026-08-25 · **Kontext:** Live-Test der neu aufgebauten Multiplayer-/Play-Mode-Schiene (nach Reset #348) zeigt mehrere UX- und Architektur-Regressionen. Diese Datei sammelt **alle** gefundenen Probleme mit Root Cause (file:line), verletztem Prinzip und Fix-Richtung. Keine Umsetzung hier — Grundlage für Requirement/Implementer.

> Bereits als GitHub-Issue erfasst: **#371** (Invite-Code-UX-Cluster). Diese Datei ist die vollständige Übersicht inkl. der Architektur-Punkte.

---

## Leitplanken (verletzte Invarianten — verbatim festhalten)

1. **`base_entities` dient AUSSCHLIESSLICH dem World-Building.** Es ist **kein** zentrales Hub für alle Tabellen. Nur Welt-Inhalte (Character/Location/Faction/Item/Quest/Event/Scene/Rule/Resource/Culture/Lore) gehören dort rein.
2. **Ein Player ist KEINE Entity.** Ein Player existiert nur in der Session/Campaign und wird über `campaign_id` + `player_id` identifiziert. Er gehört **nicht** in die Entity-Bibliothek.
3. **Der Charakter-*Bogen* darf konzeptionell entity-artig sein** — aber ein Player-Charakter darf die Welt-Bibliothek **nicht verschmutzen** und **keine** session-/campaign-Felder als Welt-Eigenschaften tragen.
4. **Der Player-Client ist ein reiner View OHNE eigene DB.** Ein Spieler hat die Projekt-DB **nicht** auf seinem Rechner. Im Play-Modus darf **niemals** direkt auf die (Host-)DB zugegriffen werden — der Client rendert nur, was der Host **über den Transport gefiltert pusht** (S09 / Decision 8). DB-Hoheit liegt allein beim Host (DM).
5. **Lokaler 2-Instanz-Test ≠ echtes Multiplayer.** Zwei Instanzen desselben Projekts teilen sich **dieselbe SQLite-DB + dasselbe localStorage** → kein Host↔Client-Test. Und ein zweiter PC hilft aktuell auch nicht (siehe P0-ARCH: es gibt gar keinen Client-Pfad).

---

## P0-ARCH — Kein Host↔Client-Datenmodell: „Play-Modus" liest lokale DB, Transport ist toter Code

**Das ist der Wurzel-Befund unter allen anderen Multiplayer-Problemen.**

**Symptom-Herkunft:** „2. Instanz ist ohne Code drin", „Code weg beim Wechsel", „Spieler als Entities" — all das sind Folgen davon, dass es **gar keinen echten Client** gibt. Was als „Play-Modus / als Player beitreten" existiert, ist ein **lokaler Host-seitiger Vorschau-View auf die eigene DB** mit Read-only-Gating (S23) + in-process angewandtem Filter — **kein** vernetzter Client.

**Root Cause (verifiziert per grep):**
- **Der Transport wird von KEINER UI benutzt.** `WebRtcTransport` wird nirgends instanziiert; `WebRtcTransport.host(...)`/`new WebRtcTransport` nie aufgerufen; `attachVisibilityBroadcaster` nie aufgerufen. `webrtc-transport.ts` + `session-transport.ts` sind **totes Primitiv**.
- **Der gesamte Play-/Player-Pfad liest die lokale DB:** `PlayModeView` (`useDatabase()`, `listEntitiesByType`, `filterEntitiesForPlayer`), `PlayerCharacterSheet`, `PlayerJoinView`, `LobbyPanel` — alle gegen `database`. Es gibt **keine** Stelle, die Daten aus dem Transport bezieht.
- Damit existiert **kein Host↔Client-Boundary**. „Filterung host-seitig, nichts Nicht-Freigegebenes verlässt den Host" (Decision 8, S09) ist **nicht durchgesetzt/nicht testbar**, weil es keine Leitung gibt, über die etwas „den Host verlassen" könnte — der Filter läuft nur lokal im DM-Prozess.

**Warum das gefährlich ist (User-Punkt, korrekt):** Auf einem **echten Spieler-Rechner gibt es die Projekt-DB nicht**. Der jetzige Player-View würde dort **nichts** anzeigen können, weil er `listEntitiesByType`/`database` erwartet. Der Play-Modus muss ein **DB-loser, transport-gespeister View** sein — der aktuelle Direkt-DB-Zugriff ist ein Test-/Platzhalter-Artefakt, das **niemals** der ausgelieferte Player-Pfad werden darf.

**Kann man das same-machine testen? → Nein. Anderer PC? → aktuell auch nicht.** Es gibt (a) keine Signaling-/Transport-Verdrahtung, die zwei Maschinen verbindet, und (b) keinen DB-losen Client, der Daten über die Leitung empfängt. Ein zweiter PC hätte nichts zu rendern. **Nicht** den zweiten Rechner anwerfen — es gibt schlicht noch keinen Client-Pfad.

**Fix-Richtung (groß, Requirement/Architektur):**
- **Host-Rolle:** hält DB, hostet Peer (`WebRtcTransport.host(db)` wirklich instanziieren), wendet `filterEntitiesForPlayer`/`resolveSessionVisibility` an und **pusht** nur Freigegebenes über den DataChannel (`attachVisibilityBroadcaster` verdrahten).
- **Client-Rolle:** **kein** `useDatabase()`; ein transport-gespeister Store (empfangene, bereits gefilterte Daten). `PlayModeView` im Client-Modus rendert aus diesem Store, nicht aus der DB.
- Das ist im Kern **S01 + S09 + S11/S12** zusammengezogen — bisher als Primitive/vertagt vorhanden, aber nie zu einem echten Client-Pfad verbunden. Bis dahin ist „Multiplayer" nur eine lokale Vorschau.

---

## P0 — Architektur: Player-Charaktere verschmutzen die Welt-Bibliothek

**Symptom (Live):** Unter Typ „Charakter" tauchen Spieler-Charaktere auf (ADen/Andrew/Sylass). In deren „Eigenschaften" stehen `is_player_character: true`, `campaign_id`, `player_id` — Felder, die ein Welt-Charakter nie haben soll.

**Root Cause:**
- `src/services/player-character-service.ts:79` — `createPlayerCharacter` schreibt in **`base_entities`** mit `type='Character'` und `is_player_character/campaign_id/player_id` im `properties_json`.
- `src/services/entity-service.ts:22` — `listEntitiesByType` macht `SELECT … WHERE type = ?` **ohne** Filter auf `is_player_character`. → Player-Charaktere erscheinen 1:1 in der Welt-Charakter-Liste.
- Kein einziger Ort filtert `is_player_character` heraus (`grep` bestätigt).

**Verletztes Prinzip:** Leitplanke 1 + 2. `base_entities` als „zentrales Hub" missbraucht; Player-Konzept ins World-Building geleakt.

**Umfang (M10):** Innerhalb M10 ist nur `player-character-service` der Verursacher. Der andere `base_entities`-Writer (`event-entity-service.ts:84`) gehört nicht zu M10 — ist aber **ebenfalls fragwürdig**, siehe „Verwandter Befund" unten (Event-Entity-Grenze überladen).

**Fix-Richtung (zu entscheiden):**
- **Option A (sauber):** Player-Charakterbogen in eine **eigene, campaign-scoped Tabelle** (z.B. `player_characters` / `character_sheets`) statt in `base_entities`. Player-Konzept bleibt komplett aus dem World-Building raus.
- **Option B (Kompromiss, „Bogen = Entity"-Idee behalten):** Player-Charaktere bleiben `base_entities`, aber (a) **eigener `type`** (z.B. `PlayerCharacter`) oder ein hartes Flag, das (b) **überall aus der Welt-Bibliothek gefiltert** wird (`listEntitiesByType` + Suche + Graph + Relations-Picker), und (c) `campaign_id/player_id/is_player_character` liegen **nicht** als sichtbare Welt-Properties vor, sondern in einer Seiten-/Zuordnungstabelle.
- Entscheidung gehört zur Requirement-Phase; A ist prinzipientreuer, B näher an der bestehenden „Bogen als Entity"-Idee.

**Betroffene Issues:** #357 (S08 Charakterbogen) — die Speicher-Entscheidung war falsch/unspezifiziert.

---

## P1 — Invite-Code-UX kaputt (= #371)

**Kern-Symptom (das eigentliche Ärgernis):** Beim Hin-und-Her-Wechseln des Menüs ist der **bereits erzeugte Code einfach weg** — man hat **keine Chance**, den (noch gültigen!) Code nochmal zu kopieren und zu verschicken, nur weil man kurz in einem anderen Menü war. Der Code ist **nicht** aus der DB gelöscht, er wird bloß **nicht wieder angezeigt**.

**Root Cause (das ist das Problem):**
- `LobbyPanel` + `CampaignRosterPanel` halten den Code nur im lokalen React-State (Start `''`) und laden beim Mount **keinen** existierenden aktiven Code; `WorkspaceShell` reicht der Lobby keinen Persist-/Reload-Weg. → Unmount (Menü verlassen) verwirft den State, Re-Mount startet leer. Der aktive Code liegt weiter in `invite_codes`, ist aber im UI **unerreichbar**.

**Sekundär (auch unerwünscht, aber nicht der Kern):**
- `session-identity-service.ts:53` `generateInviteCode` **invalidiert bei jedem Aufruf** alle aktiven Codes der Campaign. Nervig, wenn man versehentlich neu generiert — aber nicht der Grund, warum der Code beim Menüwechsel verschwindet.
- **Zwei Code-Quellen** für dieselbe `campaign_id` (🎭 Roster **und** Play-Lobby), je eigener State → der eine zeigt einen bereits invalidierten Code (Live: T36G9VK2 tot, 5HC2YFZZ gültig).

**Verletztes Prinzip:** Anzeige-State nicht aus der Wahrheit (DB) rehydriert; „gebaut, aber nicht an Laden/Persistenz verdrahtet".

**Fix-Richtung (Kern zuerst):** `getActiveInviteCode(db, campaignId)` (`… status='active' ORDER BY created_at DESC LIMIT 1`); **beim Mount jedes Panels laden**, damit der gültige Code nach Menüwechsel sofort wieder da ist und kopierbar bleibt. Erst danach: „Neu generieren" auf **explizite** Rotate-Aktion beschränken und beide Panels über dieselbe Quelle speisen.

---

## P1 — Campaign-Panel (🎭 CampaignRosterPanel): falsch im Edit-Modus platziert

**Symptome:** Trotz ausgewählter Campaign „test" wird präsent „neue Campaign anlegen" angeboten; „Gruppe anlegen" scheint nichts zu tun.

**Eigentlicher (struktureller) Root Cause — Modus-Verwechslung:**
- Das 🎭-Panel läuft **nur im Edit-Modus**: `campaigns` ist **nicht** in `PLAY_AREAS` (`WorkspaceShell.tsx:101`), im Play-Modus also ausgeblendet.
- **Mitglieder** (`session_players`) entstehen **ausschließlich** über `joinWithCode` aus `PlayerJoinView` — das ist **Play-Modus**. `CampaignRosterPanel` legt selbst **nie** Mitglieder an (`grep` bestätigt: kein `createPlayer`/`joinWithCode` dort).
- Folge: Im Edit-Modus gibt es beim normalen Campaign-Setup **strukturell keine Mitglieder** (sie joinen erst später im Play-Modus). Damit ist die **Gruppen-Zuordnung** — die einzige Stelle, an der Gruppen überhaupt gerendert werden (per-Mitglied-Toggles, ~Zeile 245) — **unbenutzbar**. Man kann Gruppen nicht vorkonfigurieren (keine Mitglieder), und Mitgliederverwaltung im Edit-Modus ist rückwärts: Roster/Mitglieder/Gruppen sind **Session-/Play-Konzepte**, keine Autoren-/World-Building-Konzepte.

**Sekundäre UI-Bugs (obendrauf):**
- Gruppen werden zwar angelegt (`handleCreateGroup` → `createGroup` → INSERT), aber es gibt **keine eigene Gruppen-Liste** — sichtbar nur der verschwindende „Noch keine Gruppen"-Text → wirkt wie No-op.
- `CampaignRosterPanel.tsx:163-188` zeigt das „Neue Campaign"-Formular **bedingungslos**, auch bei bereits gewählter Campaign.

**Verletztes Prinzip:** Modus-Trennung (analog Leitplanke 1/2): Session-/Play-Konzepte (Roster, Mitglieder, Gruppen-Zuordnung) gehören **nicht** in den Edit-/Autoren-Modus. Zusätzlich: UI-State nicht vollständig gerendert.

**Fix-Richtung (zu entscheiden, Requirement):**
- Roster + Mitglieder + **Gruppen-Zuordnung** dorthin, wo Mitglieder existieren = **Play-Modus / Live-Session** (bei der Lobby, S06).
- Im Edit-Modus verbleibt sinnvoll: reine **Campaign-Verwaltung** (CRUD + persistenter Invite-Code) und evtl. **Gruppen-Definition** (nur Namen anlegen), aber **Zuordnung** erst live. „Neue Campaign"-Form einklappen, wenn Auswahl existiert; echte Gruppen-Liste rendern.

> Merke: derselbe Grundfehler wie P0 — ein **Session-/Laufzeit-Konzept** wurde in eine **Autoren-/World-Building-Fläche** gelegt.

---

## P1/Architektur — Lokale 2-Instanz-„Joins" sind Schein

**Symptom:** 2. Instanz braucht **keinen** Code — erkennt „die Session" und ist sofort drin (soll nicht sein).

**Root Causes:**
1. **Gleiches localStorage:** `PlayerJoinView` macht beim Mount **Auto-Reconnect** aus `listStoredTokens()[0]`. Beide Instanzen = dieselbe Maschine = dasselbe localStorage → Instanz 2 findet das Token von Instanz 1 und joint automatisch.
2. **Gleiche DB:** Beide öffnen **dieselbe Projekt-SQLite**. `validateToken` prüft gegen genau diese DB → immer „aktiv". Keine Host↔Client-Trennung.
3. Das frühere separate Player-Fenster (`#/player`) wurde beim Umbau **absichtlich entfernt** (D25/D26 GM-Self-Join im DM-App-Toggle).

**Verletztes Prinzip:** Leitplanke 4. Echtes Multiplayer ist nicht lokal-2-Fenster-testbar, solange kein Transport existiert.

**Fix-Richtung:**
- Kurzfristig: Auto-Reconnect **explizit/opt-in** statt still automatisch (behebt das „ungewollt drin").
- Eigentlich: **Transport/Signaling** (S11/S12, #367/#368, D28) bauen, damit getrennte Peers gegen den Host-DataChannel joinen — erst dann ist 2-Instanz-Test real. Bis dahin ist „lokal joinen" konzeptionell nicht abbildbar.

---

## Verwandter Befund (KEIN M10 — durch diese Analyse aufgefallen): Event-Entity-Grenze überladen

**Beobachtung (User):** Nicht nur narrative/kalendarische Events, sondern auch **Mechanik-Events** (Runden, Encounters, Kampf-Zustände) tauchen als „Event" auf — das ist derselbe Prinzip-Bruch wie P0: Mechanik ≠ World-Building.

**Bestandsaufnahme (vorläufig, muss auditiert werden):**
- `event-entity-service.ts` (M14 / #259) speichert Events als `base_entities.type='Event'` mit `event_kind: 'single'|'phase'`, `start_day`, Kategorien inkl. **`battle`**. Das ist als **narrative Zeitleiste** gedacht (World-Building) — vertretbar.
- Session-**Runden** liegen dagegen in `session_log` (`payload_json.round`, `session-log-service.ts:4`) — also **nicht** in `base_entities`. Das ist die richtige Trennung.
- **Offen/zu prüfen:** Wo genau der User „Mechanik-Events als Entity" sieht. Kandidaten für die Vermischung: die Kategorie `battle` verwischt narrativ vs. mechanisch; evtl. werden Encounters/Kampf-Konstrukte anderswo als `Event`-Entity modelliert. → **fokussiertes Audit** nötig, welche Konzepte fälschlich in `base_entities` (bes. `type='Event'`) liegen.

**Prinzip:** Leitplanke 1 gilt auch hier — `base_entities` nur für World-Building. Mechanik-/Session-Laufzeit-Konstrukte (Runden, Encounters, Kampf-State) gehören in **session-/campaign-scoped** Tabellen, nicht in die Entity-Bibliothek.

**Einordnung:** Eigenständige Baustelle, **nicht M10**. Hier nur festgehalten, weil sie durch die P0-Erkenntnis (Entity-Hub-Missbrauch) sichtbar wurde. Verdient ein eigenes Audit-Issue außerhalb dieser M10-Runde.

---

## Meta-Muster (warum das durchrutschte)

- **Grün getestet ≠ integriert/architekturkonform.** Services + UI + Unit-Tests wurden pro Story gebaut und auf grünen Tests geschlossen — die *Architektur-Prüfung* („darf das in `base_entities`?", „eine Code-Quelle?", „ist lokal überhaupt testbar?") fehlte.
- **`base_entities` als Verlockung zum Allzweck-Hub.** Genau das ist zu unterbinden (Leitplanke 1). Jede neue „X als Entity"-Idee muss die World-Building-Grenze respektieren.
- **Kein End-to-End-Live-Blick vor dem Schließen.** Die meisten Punkte hier sieht man erst beim Klicken, nicht im Test.

---

## Vorschlag Reihenfolge (wenn abgearbeitet wird)

**Zuerst eine Grundsatz-Entscheidung (Requirement/Architektur), bevor irgendwas gefixt wird:**
- **P0-ARCH — Host↔Client-Datenmodell festlegen.** Player-Client = DB-loser, transport-gespeister View; Host pusht gefiltert. Das ist der große Brocken (S01+S09+S11/S12 zusammengezogen) und definiert, ob die kleineren Fixes überhaupt am richtigen Ort landen. Solange das offen ist, ist „Multiplayer" nur lokale Vorschau.
- **P0-ARCH-Klärung: Modus-Grenze.** Was ist Autoren-/Edit-Sache (DB, World-Building, Campaign-CRUD) vs. Session-/Play-Sache (Roster, Mitglieder, Gruppen-Zuordnung, Live-View)? Das entscheidet P0-Entity und P1-Campaign-Panel gleich mit.

**Danach, konkret:**
1. **P0 Entity-Pollution** — Speicherort für Player-Charaktere entscheiden (A/B) + Welt-Bibliothek/Suche/Graph filtern. (Verschmutzt bereits Live-Daten.)
2. **P1 Campaign-Panel im richtigen Modus** — Roster/Mitglieder/Gruppen-Zuordnung in den Play-/Live-Kontext; Edit-Panel auf Campaign-CRUD + persistenten Code reduzieren.
3. **P1 Invite-Code-UX** (#371) — aktiven Code beim Mount laden (Kern), Single Source, Rotate nur explizit.
4. **Auto-Reconnect opt-in** (entschärft den Schein-Join same-machine).
5. **Verwandt/nicht-M10:** Event-Entity-Grenze auditieren (Mechanik vs. narrativ).
