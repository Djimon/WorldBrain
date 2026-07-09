# UI/UX Sprint — Entity UI Polish

Modus: UI/UX-Sprint (siehe AGENTS.md). Reviewer + Umsetzer in engen Loops. Nur Präsentation/Interaktion, keine Basis. Commits sauber pro Änderung, Push gebündelt am Sprint-Ende.

Vorgeschichte: Karten-Sprint abgeschlossen. Jetzt Entity-Seiten.

## Änderungslog

| # | Änderung | Entscheidung / Warum | Dateien |
|---|----------|----------------------|---------|
| 1 | Neuer Tab **„Verlinkungen"** (Backlinks) auf der Entity-Seite | Wunsch: sehen, welche Entities *diese* via `@Name` erwähnen, klickbar dahin springen. Reverse-Lookup über `@[Name](id)` in summary + properties_json; präzise per `parseMentions` verifiziert (LIKE nur Vorfilter). `onNavigate` durch die Tab-Render-Signatur gereicht (registrierte Tabs konnten vorher nicht navigieren). | `src/ui/BacklinksTab.tsx` (neu), `src/ui/EntityDetailView.tsx`, `src/tab-wiring.tsx`, `src/style.css` |
