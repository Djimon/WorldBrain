# EPIC-013: Session Play Mode

## Goal

Der Play-Modus macht WorldBuilderX am Spieltisch nutzbar. Sessions sind persistierte Logbücher einer Kampagne — zeitlich unbegrenzt, immer vom letzten Stand fortgeführt. M0–M7 bauen die Welt. M8 spielt sie.

## Decisions

1. **Session-Objekt:** Eine Session ist ein persistiertes JSON-Objekt (`sessions/<id>.json`) im Projektordner. Felder: `id`, `title`, `project_id`, `system_plugin_id` (optional, welches Regelwerk-Plugin aktiv ist), `created_at`, `last_active_at`, `calendar_position` (Weltzeit-Stand), `archived: bool`. Welt (Projekt) = system-agnostisch. System = Plugin. Kombination passiert auf Session-Ebene — Wechsel des Systems = neue Session.
2. **1 aktive Session:** Mehrere Sessions pro Projekt möglich, aber immer nur eine gleichzeitig aktiv. Beim Öffnen eines Projekts wird die zuletzt aktive Session automatisch fortgesetzt.
3. **Zeitachse:** Projekt hat genau einen Kalender (M5-S01) = automatisch geteilte Weltzeit-Achse für alle Sessions des Projekts.
4. **Cross-Session World State:** Wenn Session A in der Weltzeit Punkt X überschreitet, sieht Session B (die denselben Punkt später erreicht) die Konsequenzen: Chronicle-Einträge automatisch sichtbar, Entity-Zustände wenn explizit als "Weltänderung" markiert, Items nur wenn als "unique" markiert.
5. **Play-Mode Screen:** Eigener Modus (analog: Map-Editor vs. Spiel). Tab 1 = konfigurierbares GM-Whiteboard. Tab 2 = Karte (immer vorhanden). Weitere Tools über linke Sidebar als schließbare Tabs öffnbar.
6. **Encounter:** Im Create-Modus vorbereitet (eigene Map). Im Play-Modus per "Encounter starten" als temporärer Raum geöffnet. Nach Encounter-Ende geschlossen, Ergebnis ins Session-Log eingetragen. Encounter-Organisation frei: root der Welt, an Ort verknüpft, oder in GM-eigenen Hilfsordnern ("Abend 1", "Abend 2").
7. **Character-Panel:** Name, Spieler-Name, Freinotiz + Felder die das aktive System-Plugin definiert (falls geladen). Vollständiges Character Sheet mit System-Mechaniken → M9.
8. **Session-Log:** Jede Aktion wird geloggt mit Echtzeit-Timestamp + aktuelle Weltzeit + aktuelle Runde (wenn Rundenconter aktiv). Log ist querybar. Markdown-Export des Logs für Recaps.
9. **Entity Session Notes:** Jede Entity kann opt-in Session-scoped Notizen und Zustandsänderungen erhalten. Nicht verpflichtend — DM entscheidet wie detailliert er mitschreibt.

## Out of Scope

- Echtzeit-Kollaboration
- Cloud-Sync
- AI-generierte Recaps
- Vollständiges Character Sheet mit System-Mechaniken (→ M9)
- System-Plugin & Character Sheet Binding (→ M9)
- Dice Expression Berechnungen innerhalb von Stat Blocks (→ M9)

## Stories

### M8-S01: Session-Schema & Persistenz

**Ziel:** Sessions sind vollständig persistierte Objekte im Projektordner.

**AC:**
- `sessions/<id>.json` im Projektordner, Schema: `id` (ULID), `title`, `project_id`, `system_plugin_id` (optional), `created_at`, `last_active_at`, `calendar_position`, `archived`
- Session-Service: create, load, save, archive, list
- Nur eine Session kann `active: true` sein — beim Aktivieren einer anderen wird die bisherige deaktiviert
- Beim Öffnen eines Projekts wird die zuletzt aktive Session automatisch geladen
- Fehlerhafte/fehlende Session-Datei → Fehlermeldung, kein Crash
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API

---

### M8-S02: Session-Liste & Verwaltung

**Ziel:** GM kann Sessions anlegen, fortsetzen und archivieren.

**AC:**
- Session-Liste im UI: Titel, Erstellt-Datum, Letzter Stand, Weltzeit-Position
- Neue Session anlegen: Titelfeld (Pflicht), optional: Startdatum in Weltzeit
- Session fortsetzen: lädt Session und wechselt in Play-Modus
- Session archivieren: bleibt lesbar, taucht nicht mehr in der Hauptliste auf
- Archiv-Ansicht zeigt archivierte Sessions (wiederherstellbar)
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API

---

### M8-S03: Play-Mode Screen & GM-Whiteboard

**Ziel:** Eigener Modus-Screen für den Spielbetrieb mit konfigurierbarem Whiteboard.

**AC:**
- Dedizierter Play-Mode Screen, erreichbar über Modus-Toggle (Create ↔ Play)
- Tab 1 (Whiteboard): GM kann Widgets per Drag-and-Drop hinzufügen und entfernen. Widgets: Counter, Session-Variablen, aktive Encounter-Info, Notizfeld, Entity-Schnellzugriff. Layout wird pro Session persistiert.
- Tab 2 (Karte): immer vorhanden, nicht schließbar, zeigt aktive Projektkarte
- Linke Sidebar: Tool-Launcher mit Icons für: Encounter-Liste, Character-Panel, Entity-Notizen, Session-Log, Kalender/Zeit, Regeln (DM Screen). Jedes Tool öffnet als schließbarer Tab.
- Tab-Reihenfolge per Drag-and-Drop änderbar
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M8-S04: Cross-Session World State

**Ziel:** Abgeschlossene Ereignisse einer Session sind für andere Sessions sichtbar sobald sie denselben Weltzeit-Punkt erreichen.

**AC:**
- Chronicle-Einträge mit Weltzeit-Datum: automatisch sichtbar in jeder Session die diesen Zeitpunkt überschritten hat
- Entity-Zustand (z.B. NPC-Status "tot"): sichtbar wenn Eintrag als `world_change: true` markiert ist und Session den Weltzeit-Punkt überschritten hat
- Items: nur wenn `unique: true` markiert
- GM markiert Änderungen beim Eintragen als "Weltänderung" oder "nur diese Session"
- Keine automatische Konflikt-Auflösung bei widersprüchlichen Weltänderungen — beide sichtbar, GM entscheidet
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M8-S05: Session-Log

**Ziel:** Jede Aktion in einer Session wird chronologisch geloggt und ist nachvollziehbar.

**AC:**
- Jeder Log-Eintrag: `id`, `session_id`, `real_timestamp`, `world_datetime` (Weltzeit), `round` (wenn Rundenconter aktiv, sonst null), `action_type`, `description` (kurzer Text), `entity_id` (optional)
- Log ist im UI durchsuchbar und filterbar (nach Zeitraum, Entity, Aktionstyp)
- Log persistiert in `sessions/<id>/log.json` oder als Teil des Session-JSON
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M8-S06: Session-Log Markdown-Export

**Ziel:** Der Session-Log kann als lesbarer Recap-Text exportiert werden.

**AC:**
- Export erzeugt Markdown-Datei mit Log-Einträgen gruppiert nach Weltzeit-Abschnitt
- Format pro Eintrag: `[Weltzeit] Reale Zeit — Beschreibung`
- Nutzer wählt Zeitraum (ganze Session oder Datumsbereich)
- Speicherort via Tauri save-dialog
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

### M8-S07: Encounter-Modus

**Ziel:** GM startet einen vorbereiteten Encounter als temporären Raum, der nach Ende geschlossen wird.

**AC:**
- Encounter-Maps sind normale Maps im Projektordner, erkennbar an `type: encounter` in den Map-Metadaten
- Encounter-Suche im Play-Modus: Liste aller Encounter-Maps, filterbar nach verknüpftem Ort (falls vorhanden)
- GM-Hilfsordner ("Abend 1" etc.) erscheinen als Gruppen in der Encounter-Liste
- "Encounter starten" öffnet die Map als temporären Tab (eigenes Raster, Tokens, Bewegungen)
- "Encounter beenden" schließt den Tab, legt automatisch einen Log-Eintrag an (Dauer, Runden wenn gezählt)
- Encounter-Zustand (Token-Positionen, Rundenzähler) wird nicht dauerhaft gespeichert — nach Schließen weg
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API

---

### M8-S08: Character-Panel

**Ziel:** GM trackt Spielercharaktere mit Basisinfos und opt-in System-Feldern.

**AC:**
- Character-Panel zeigt alle Entities vom Typ "Character" mit `is_player_character: true`
- Felder immer vorhanden: Name, Spieler-Name, Freinotiz
- Wenn ein System-Plugin geladen ist und einen `player_character`-Entity-Type definiert: dessen Felder werden zusätzlich angezeigt und sind editierbar
- Änderungen an Character-Feldern während der Session erzeugen einen Log-Eintrag
- Kein System-Plugin aktiv: nur Basisfelder sichtbar
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M8-S09: Entity Session Notes

**Ziel:** GM kann an jeder beliebigen Entity Session-scoped Notizen und Zustandsänderungen festhalten.

**AC:**
- Jede Entity hat im Play-Modus einen "Session Notes"-Bereich (opt-in, eingeklappt by default)
- Notizen sind session-scoped (nicht im Basis-Entity gespeichert) es sei denn GM markiert explizit "in Welt übernehmen"
- "In Welt übernehmen" schreibt die Änderung als `world_change: true` in den Session-Log und aktualisiert die Basis-Entity
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

---

### M8-S10: Würfelpanel

**Ziel:** GM hat im Play-Modus ein jederzeit erreichbares Würfel-Panel zum Auswürfeln beliebiger Ausdrücke.

**AC:**
- Panel ist über die Sidebar als Tool öffnbar (schließbarer Tab)
- Unterstützte Würfel: W4, W6, W8, W10, W12, W20, W100
- Eingabefeld für Würfelausdruck (z.B. `2d6+3`, `1d20`, `4d8+12`)
- "Würfeln"-Button: führt Würfelwurf aus, zeigt Einzelergebnisse + Gesamtsumme
- Ergebnishistorie der letzten 10 Würfe sichtbar
- Würfelausdruck kann vorgeladen werden (für Klick-Integration aus M8-S11)
- Zufallsgenerator kryptografisch sicher (`crypto.getRandomValues`)
- No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API
- `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites

---

### M8-S11: Globaler Dice-Link-Layer

**Ziel:** Jeder Würfelausdruck irgendwo in der App-UI wird automatisch klickbar und öffnet das Würfelpanel mit vorgeladenem Ausdruck.

**AC:**
- Regex erkennt Würfelnotation in Texten: `XdY`, `XdY+Z`, `XdY-Z` (case-insensitive, d oder D)
- Alle Text-Render-Stellen die Würfelnotation enthalten (Stat Blocks, Entity-Beschreibungen, Session Notes, Regeltexte) rendern diese als klickbare Spans
- Klick auf eine Würfelnotation → Würfelpanel öffnet sich (falls nicht schon offen), Ausdruck wird vorgeladen
- GM muss nur noch "Würfeln" drücken
- Dice-Link-Layer funktioniert ausschließlich im Play-Modus (nicht im Create-Modus)
- Kein Dice-Link innerhalb von Eingabefeldern oder Editoren
- All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output

---

## Story Tracking

| Story | ID | Titel |
|---|---|---|
| M8-S01 | #152 | Session-Schema & Persistenz |
| M8-S02 | #153 | Session-Liste & Verwaltung |
| M8-S03 | #154 | Play-Mode Screen & GM-Whiteboard |
| M8-S04 | #156 | Cross-Session World State |
| M8-S05 | #157 | Session-Log |
| M8-S06 | #158 | Session-Log Markdown-Export |
| M8-S07 | #159 | Encounter-Modus |
| M8-S08 | #160 | Character-Panel |
| M8-S09 | #161 | Entity Session Notes |
| M8-S10 | #162 | Würfelpanel |
| M8-S11 | #163 | Globaler Dice-Link-Layer |

## Abhängigkeiten

- M7 (EPIC-012): Projektordner-Struktur stabil
- M5-S01–S08: Calendar/Event/Counter-Grundlage
- M4-S01–S09: Session-Variablen-System
- M6-S01–S06: Plugin-System (für Character-Panel System-Felder)
