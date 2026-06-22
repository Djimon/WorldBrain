# 10 MVP Spec Decisions

Dieses Dokument haelt die strukturierten Antworten auf die "Next Concrete Spec Questions" aus `09_Decision_Log_And_Open_Questions.md` fest.

Ziel ist kein kompletter MVP-Scope, sondern ein belastbarer Entscheidungsstand fuer ein spaeteres technisches Proof-of-Concept und V1-Spec.

## 1. Core Entity Types fuer V1

V1 bekommt feste Core Entity Types:

- Character
- Location
- Faction
- Item
- Event
- Quest
- Scene
- Rule
- Resource
- Culture

`Organization` wird nicht als eigener Core Type benoetigt. Organisationen werden ueber `Faction` mit Subtypen/Properties modelliert, z.B. `guild`, `kingdom`, `church`, `company`, `cult`, `tribe`.

Plugins duerfen Core Types additiv erweitern und eigene Entity Types liefern.

## 2. Texteditor und Body Storage

Interne Wahrheit fuer Body Content ist Block-JSON, z.B. `portable_blocks_v1`.

Die Editor-UX soll Markdown-first sein:

- Nutzer schreiben in einem vertrauten Markdown-nahen Flow.
- V1 baut keinen eigenen WYSIWYG-Editor von null.
- Eine bestehende Editor-Basis wird genutzt.
- Markdown Import/Export bleibt wichtig.

Markdown ist damit Authoring-/Exportformat, aber nicht die alleinige interne Wahrheit.

Der Block-JSON-Body muss strukturierte Spezialbloecke unterstuetzen:

- paragraph
- heading
- list
- entity_embed
- secret_block
- condition_block
- map_embed
- timeline_embed
- rule_reference
- card_preview

## 3. Condition Engine

V1 speichert Conditions als JsonLogic.

Nutzer bearbeiten Conditions ueber einen visuellen Condition Builder.

Ein Poweruser-/Textmodus ist nicht V1-pflichtig und kann spaeter ergaenzt werden.

Nicht erlaubt:

- JavaScript `eval`
- frei ausfuehrbare Plugin-Scripts
- beliebige ungesicherte Formelausfuehrung

JsonLogic wird fuer Session Visibility, Map Marker Visibility, Handouts, Card Exports und Trigger genutzt.

## 4. PDF/Card Export

PDF/Card Export ist V1-pflichtig.

Cards sind Projections/Views auf Entity-Daten, keine eigene Wahrheit.

V1 unterstuetzt:

- Card Templates per JSON
- A4 3x3 Print Sheet
- PDF Export
- PNG Export
- Standardgroessen: Poker, Tarot, A4 Sheet, Moderationskarte
- Anwendung von Visibility-Regeln beim Export

Nicht V1-pflichtig:

- freier Drag-and-Drop-Card-Designer
- pixelgenaue Layout-Bearbeitung fuer beliebige Templates

## 5. Minimaler Plugin-Ordner

Plugins sind ordnerbasiert.

Pflichtdatei:

```text
plugin.json
```

Optionale Unterordner:

```text
entity_types/
relation_types/
views/
card_templates/
rules/
assets/
```

Beispiel:

```text
plugins/
  example-plugin/
    plugin.json
    entity_types/
    relation_types/
    views/
    card_templates/
    rules/
    assets/
```

V1-Sicherheitsregeln:

- JSON Schema ist Pflicht.
- UI Schema ist optional.
- Custom Renderer duerfen nur aus der Core Renderer Registry referenziert werden.
- Plugins enthalten keine frei ausfuehrbaren Scripts.

## 6. JSON Exportstruktur

Die primaere Projektstruktur besteht aus vielen JSON-Dateien in einem Projektordner.

Der Standard fuer Austausch ab V1 ist ZIP Import/Export.

Das ZIP enthaelt die vollstaendige Projektordner-Struktur, nicht ein einzelnes Mega-JSON.

Lokale Arbeit passiert in einem entpackten, editierbaren Projektordner.

Beispielstruktur:

```text
project.json
entities/
  character/
  location/
  faction/
  culture/
relations/
maps/
sessions/
views/
plugins/
assets/
```

## 7. Undo und History

Editor Undo ist erlaubt, wenn die Editor-Basis es standardmaessig liefert, z.B. Strg+Z.

App-weites Undo ist nicht V1-pflichtig.

V1 braucht gezieltes Session Undo fuer GM-Missklicks im Session-Modus.

Session Undo soll mindestens Aktionen wie diese abdecken:

- Reveal rueckgaengig machen
- Session Variable zuruecksetzen
- Marker-Sichtbarkeit rueckgaengig machen
- Counter/Ticker-Aktion zuruecknehmen

Das allgemeine Datenmodell ist replace-first:

- keine vollstaendige Entity-History in V1
- keine komplexe History-UI
- automatische Backups/Snapshots bei Save/Import/Export sind sinnvoll

## 8. Git-kompatible Projektordner

Git-Kompatibilitaet ist ein explizites V1-Ziel.

Die App muss in V1 keine Git-UI anbieten.

Regeln:

- Eine Entity pro JSON-Datei.
- Pretty-printed JSON.
- Stabile Dateinamen.
- Deterministische Ausgabe, soweit praktikabel.
- Assets liegen separat.
- SQLite Runtime DB ist Cache, nicht Ground Truth.
- Search Index und Runtime-Dateien gehoeren in `.gitignore`.

## 9. Referenz-UI-Technologie

Referenztechnologie fuer V1:

- React
- TypeScript
- lokal gehostete Web-App

Spaeteres Desktop Packaging:

- bevorzugt Tauri
- pywebview bleibt als schneller Prototyp-Kandidat offen

Empfohlene UI-Bausteine:

- Markdown-first Editor auf bestehender Editorbasis
- JSON Schema + optional UI Schema fuer Forms
- TanStack Table fuer Tabellen
- Cytoscape.js oder React Flow fuer Graph-/Board-Views
- eigene Map Annotation ueber Canvas/SVG/WebGL statt VTT-Framework als Kern

## 10. DnD-Daten und Lizenzgrenzen

V1 importiert nur:

- Homebrew-Daten des Users
- klar lizenzierte offene SRD-Basisdaten
- JSON/CSV-Dateien, die der User bewusst bereitstellt

Das Beispiel-DnD-Plugin ist ein SRD-basiertes Struktur-/Regelplugin, kein offizieller WotC-Content-Pack.

Es darf enthalten:

- allgemeine Regeln auf SRD-Basis
- Datenmodelle
- Prefabs/Templates
- Importformate fuer JSON/CSV

Es darf nicht enthalten:

- geschuetzte Zauberlisten ausserhalb klar lizenzierter SRD-Daten
- Welten/Settings
- Abenteuer
- Monster, Items oder sonstiger Content ausserhalb klar lizenzierter SRD-Daten
- D&D Beyond Vollcontent
- Scraping geschuetzter Quellen

Wenn ein User eigenen lizenzierten oder privaten Content als JSON/CSV importiert, liegt die Rechteklaerung beim User.

Jede Rule Entity braucht Source-/Lizenz-Metadaten.

## Consolidated V1 Bias

```text
Storage:
  JSON project folder as Ground Truth
  ZIP import/export as exchange format
  SQLite as runtime/index/cache

Content:
  Entity-first model
  Block-JSON body storage
  Markdown-first editor UX

Conditions:
  JsonLogic
  visual condition builder

Plugins:
  folder-based
  plugin.json required
  JSON Schema required
  UI Schema optional
  no plugin script execution in V1

Cards:
  projection/export only
  PDF and PNG export in V1
  template-based, no full designer

Project operations:
  Git-compatible folders
  replace-first persistence
  editor undo via standard editor
  session undo for GM mistakes

UI:
  React + TypeScript local web app
  desktop wrapper later

Rules:
  source/license metadata required
  user/Homebrew/SRD-only import boundary
```

