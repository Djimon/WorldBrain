# UI/UX Sprint: Ordner-Kontextmenü + Ordnerfarbe (NestedTree)

Scope: `src/ui/NestedTree.tsx` (geteilte Komponente), Konsumenten `MapFolderTree.tsx` (Karten) und `MapViewer.tsx` (Pins). Betrifft beide Bäume gleichzeitig, da eine gemeinsame Komponente.

## Änderungen

1. **⋮-Kontextmenü statt Dauer-Button.** Der permanente "Löschen"-Button im Ordner-Header (aus #307) saß zu präsent im Drag-Bereich. Ersetzt durch einen `⋮`-Button, der nur bei Hover des Ordner-Headers sichtbar wird (`opacity:0` → `1` on hover, plus `is-open`-Klasse als Fallback solange das Menü offen ist). Menü enthält "Bearbeiten" und "Löschen".
   - **Warum:** Nutzer-Feedback beim Live-Test — der Button kollidierte visuell/interaktiv mit dem Drag-Griff.
   - Grund für ⋮ statt Doppelklick-only: Löschen soll klar von Umbenennen (Doppelklick) getrennt bleiben.

2. **"Bearbeiten" öffnet Rename-Input + Farbwahl.** Klick auf "Bearbeiten" im Menü triggert denselben internen Rename-Zustand wie der bisherige Doppelklick (`onRenameStart`), zusätzlich erscheint bei aktivem `onFolderColorChange` ein natives `<input type="color">` sowie eine Zeile mit 7 Preset-Farb-Swatches darunter.

3. **Ordnerfarbe (neues Feature).** `TreeNode.color?: string` — wird als kleiner farbiger Punkt vor dem 📁-Emoji gerendert.
   - **Karten:** `map_folders.color` (neue Spalte, idempotente Migration in `db-init.ts` + Schema-Deklaration in `core_data/map-schema.ts`). Neuer Service-Call `setFolderColor(db, id, color)`.
   - **Pins:** Pin-Ordner sind virtuell (kein eigener DB-Row, nur `group_name`-Pfad-Strings). Farbe wird im `style_json` des `folder-anchor`-Markers gespeichert (`{color: "#hex"}`). Existiert noch kein Anchor für den Pfad (z.B. implizit über verschachtelte Kind-Pfade entstandener Ordner), wird beim ersten Farbwechsel einer angelegt.

4. **Löschen jetzt für Pin-Ordner ebenfalls möglich** (vorher gab es dafür gar keinen Mechanismus). Direktes Kind-Verhalten spiegelt Karten: Kind-Pins verlieren nur ihre Ordnerzuordnung (`group_name` → `''`), kein Kaskaden-Löschen. Der `folder-anchor`-Marker selbst wird gelöscht. Gerenderter Bestätigungsdialog (AP-003, kein `confirm()`) — dieselbe Optik wie bei Karten.

5. **Nebenbei entdeckt und behoben:** `.map-folder-tree__confirm-dialog` (seit #307 im Markup) hatte nie CSS — der Löschen-Dialog rendert bislang ungestylt (Browser-Default). Jetzt gestylt (Karten und Pins teilen sich dieselbe Klasse).

## Bekannte Test-Auswirkungen (nicht selbst angepasst — Implementation-Agent-Rolle)

- `tests/m15-s05-map-folder-tree.dom.test.tsx`: 3 Tests im "Löschen-Regression"-Block scheitern, weil sie direkt `getAllByRole('button', {name:/löschen/i})` klicken — der Button existiert jetzt erst nach Öffnen des ⋮-Menüs. Verhalten selbst (Dialog erscheint, `deleteFolder` wird aufgerufen, kein Cascade) ist unverändert, nur der Interaktionspfad.
- `tests/m15-s05-map-folders.test.ts`: Ein "table shape"-Test prüft exakte Spaltenliste von `map_folders` (`['created_at','id','name','parent_id']`) — durch die neue `color`-Spalte jetzt `['color','created_at','id','name','parent_id']`. Erwartete Konsequenz der bewussten Schema-Erweiterung.
- Dieselbe Datei hat weiterhin 3 vorbestehende, unabhängige Fails wegen einer längst entfernten `maps.asset_id`-Spalte in der Fixture (verifiziert per `git stash` vor dieser Session — nicht durch diese Arbeit verursacht).

## Verifikation
- `tsc --noEmit`: 0 Fehler
- `npm run lint`: 0 Fehler
- Live-Test im Tauri-Dev-Modus ausstehend (Nutzer testet interaktiv)
