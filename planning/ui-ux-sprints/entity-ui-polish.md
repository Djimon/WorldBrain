# UI/UX Sprint — Entity UI Polish

Modus: UI/UX-Sprint (siehe AGENTS.md). Reviewer + Umsetzer in engen Loops. Nur Präsentation/Interaktion, keine Basis. Commits sauber pro Änderung, Push gebündelt am Sprint-Ende.

Vorgeschichte: Karten-Sprint abgeschlossen. Jetzt Entity-Seiten.

## Änderungslog

| # | Änderung | Entscheidung / Warum | Dateien |
|---|----------|----------------------|---------|
| 1 | Neuer Tab **„Verlinkungen"** (Backlinks) auf der Entity-Seite | Wunsch: sehen, welche Entities *diese* via `@Name` erwähnen, klickbar dahin springen. Reverse-Lookup über `@[Name](id)` in summary + properties_json; präzise per `parseMentions` verifiziert (LIKE nur Vorfilter). `onNavigate` durch die Tab-Render-Signatur gereicht (registrierte Tabs konnten vorher nicht navigieren). | `src/ui/BacklinksTab.tsx` (neu), `src/ui/EntityDetailView.tsx`, `src/tab-wiring.tsx`, `src/style.css` |
| 2 | Fix: `registerEntityTab` idempotent nach `id` | Bug aus #1 sichtbar: „Relations" doppelt. Ursache: Registrierung pushte ohne Dedup → HMR/Re-Import akkumulierte. Jetzt ersetzt gleiche `id` statt anzuhängen. | `src/ui/EntityDetailView.tsx` |
| 3 | Fix: Entity-Navigation nimmt den ganzen Baum mit | Backlink/Mention-Klick tauschte nur die Detail-View, nicht TYP-Liste + Baum-Selektion + Tab. Ursache: `navigateToEntity` setzte keinen Typ; EntityMasterDetail synct lokales `selectedId` nicht mit dem Prop; Tab resettet nicht. Jetzt: `navigateToEntity` schlägt Typ per ID nach → `setEntityType`; Detail-Nav bubbled nach oben (cross-type); `selectedId` synct auf Prop; EntityDetailView resettet Tab auf Übersicht bei Entity-Wechsel. Betraf auch den Map-Weg. | `src/ui/WorkspaceShell.tsx`, `src/ui/EntityMasterDetail.tsx`, `src/ui/EntityDetailView.tsx` |
| 4 | Fix: Timing — Selektion wurde nach Typ-Wechsel genullt | Nach #3 sprang der Typ, aber die Entity blieb unselektiert. Ursache: `selectedEntityId` wurde sofort gesetzt, `entityType` erst nach dem async Typ-Query → der initialType-Reset-Effekt (`setSelectedId(null)`) feuerte danach und überschrieb. Fix: Typ **und** ID im selben `.then`-Continuation setzen (Typ zuerst) → React batcht → Reset+Select in einem Render, Select gewinnt. | `src/ui/WorkspaceShell.tsx` |

## Kalender

| # | Änderung | Entscheidung / Warum | Dateien |
|---|----------|----------------------|---------|
| 5 | Fix: Kalender-Save warf `no column named updated_at` | `saveCalendar` schrieb `created_at, updated_at`, aber das `calendars`-Schema hat kein `updated_at` (und niemand liest es). Save warf → nichts persistiert → Edits beim Bereichswechsel weg. `updated_at` aus dem INSERT entfernt (kein Schema-Eingriff). | `src/services/calendar-service.ts` |
| 6 | Monatsansicht: echtes Grid statt vertikalem Text-Stapel | `CalendarMonthView` hatte ARIA-Rollen aber kein Layout-CSS → Wochentage + Tage stapelten vertikal. CSS-Grid mit `--cal-cols` = Anzahl Wochentage (dynamisch, auch 8+); `role="row"` per `display:contents` in den Grid-Fluss gelegt (ARIA bleibt). Kacheln mit Hover, Event-Chips. | `src/ui/CalendarMonthView.tsx`, `src/style.css` |
| 7 | Wizard: Live-Summe (Tage/Jahr + Wochen) | Auto-Update fehlte sichtbar; Wochen gar nicht. Summary-Zeile: Tage/Jahr (= Monatssumme), Wochen (= Tage ÷ Wochentage, mit Rest), Monate, Tage/Woche — reaktiv aus `months`/`week` abgeleitet, aktualisiert bei Monat-/Wochentag-Änderung. | `src/ui/CalendarWizard.tsx`, `src/style.css` |
