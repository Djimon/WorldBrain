# 05 Search Knowledge Views

## Problem

Viele moderne Wikis sehen gut aus, sterben aber in echten Projekten an:

- schlechter Suche
- fehlenden Volltextindizes
- nur Title-/Keyword-Suche
- unstrukturierten Seiten
- fehlender gefuehrter Struktur
- fehlenden Views auf dieselben Daten

Fuer Worldbuilding ist Suche kein Nice-to-have. Es ist das Rueckgrat.

## Required Views

| View | Zweck |
|---|---|
| Wiki/Text | Lesen und Schreiben |
| Table | Notion-aehnliche Datenbankansicht |
| Graph | Beziehungen verstehen |
| Map | Orte, Marker, Reise |
| Timeline | Ereignisse und Kausalitaet |
| Board | Questflows, Fraktionsplaene, Session-Planung |
| Cards | druckbare/teilbare Spielhilfen |

Alle Views muessen dieselben Entities nutzen. Keine Datenkopien.

## Search Requirements

Pflicht:

- Volltextsuche ueber Titel, Body, Summary, Properties
- Alias-Suche
- Tag-Suche
- Type-Filter
- Relation-Filter
- Fuzzy/Typo-Toleranz spaeter
- Facetten/Filter
- Suchranking
- "recently touched"
- "needs processing"

## V1 Search Stack

### SQLite FTS5

SQLite FTS5 ist fuer lokale Offline-Apps sehr attraktiv. Die offizielle Doku beschreibt FTS5 als Virtual Table Module fuer Full-Text Search in grossen Dokumentmengen.

Empfohlene Index-Tabelle:

```sql
CREATE VIRTUAL TABLE entity_search USING fts5(
  entity_id UNINDEXED,
  title,
  aliases,
  summary,
  body,
  tags,
  properties_text,
  tokenize='unicode61'
);
```

Vorteile:

- keine externe Suche
- laeuft lokal
- passt zu SQLite Runtime DB
- gut genug fuer V1

Grenzen:

- weniger bequem als dedizierte Suchmaschinen
- fuzzy search begrenzt
- komplexes Ranking selbst designen

### PostgreSQL Full Text

Wenn spaeter Postgres genutzt wird:

- `tsvector`
- GIN Indexes
- JSONB fuer Properties
- strukturierte Queries + FTS in einer DB

PostgreSQL GIN ist fuer zusammengesetzte Werte wie Dokumente oder JSONB interessant.

### Dedicated Search

| Tool | Staerke | Schwäche |
|---|---|---|
| Meilisearch | typo tolerant, schnell, einfach | extra Prozess |
| Typesense | search-as-you-type, faceted, typo tolerant | extra Prozess |
| Lunr/FlexSearch | browser/offline | grosse Projekte und Updates schwieriger |
| OpenSearch/Elasticsearch | sehr stark | zu schwer fuer V1 |

## Search UX

Suche muss mehr koennen als Trefferliste.

### Global Search

```text
silas battery

Results:
NPC: Silas
Location: Bog's Warehouse
Session: Warehouse Investigation
Relation: Silas -> Weavers
Capture: "Guard says Silas owes money..."
```

### Facets

```text
Type: Character, Location, Session, Rule
Status: active, dead, unresolved
Visibility: GM only, player known
Tags: waterdeep, battery, criminal
```

### Missing Metadata Compensation

Weil Menschen schlechte Titel und Tags vergeben:

- automatisch Body in Volltext aufnehmen
- Aliases stark gewichten
- Entity Type Synonyme erlauben
- Treffer aus Relations einbeziehen
- "mentioned in" anzeigen
- Capture Notes indexieren

## Graph View

Graph View sollte nicht der Haupteditor sein. Graphen werden schnell Hairballs.

Gute Graph-Fragen:

- Welche NPCs haengen an dieser Quest?
- Welche Factions sind im Konflikt?
- Wer kennt dieses Geheimnis?
- Welche Events verursachten diesen Zustand?

Empfohlen:

- Local Graph um eine Entity
- Filter nach Relation Type
- Depth 1-3
- Gruppierung nach Entity Type
- keine globale "alles anzeigen"-Default-Ansicht

Libraries:

- Cytoscape.js fuer Graphanalyse/-visualisierung
- React Flow fuer manuell kuratierte Boards/Flows

## Table View

Tables sollten Notion-aehnlich sein:

- Spalten frei waehlen
- Properties editieren
- Filter
- Sortierung
- Grouping
- Relation-Spalten
- Inline create
- View speichern

Eine Headless Table Library wie TanStack Table passt gut, weil die Logik getrennt von der UI bleibt.

## Wiki/Text View

Rich Text sollte strukturierte Embeds erlauben:

- Entity Mentions
- Relation Blocks
- Map Embeds
- Timeline Embeds
- Condition Blocks
- Secret Blocks
- Card Preview Blocks

Technisch bieten sich ProseMirror/Tiptap-artige Editoren an, weil sie ein strukturiertes Dokumentmodell statt nur HTML erlauben.

## Board View

Boards sind fuer:

- Quest Dependency
- Faction Plan
- Mystery Board
- Session Flow
- Clue Network
- Region Design

Wichtig: Board Nodes sollten Entities referenzieren, nicht kopieren.

```json
{
  "node_id": "boardnode_01",
  "entity_id": "quest_arcane_battery",
  "position": {"x": 100, "y": 200},
  "display": "quest_card"
}
```

## Decision Questions

1. Ist SQLite FTS5 fuer V1 ausreichend? --> ja
2. Soll Fuzzy Search in V1 rein oder spaeter? --> am liebsten ja
3. Soll Search Index aus JSON jedes Mal neu gebaut werden koennen? --> eher Db als json oder? aber  ja
4. Soll Graph View nur lokal oder global verfuegbar sein? --> global, aber mit interaktivne Filtern -> je nach Einstiegspunkt
5. Wird Wiki-Text als Markdown, HTML oder strukturierter Block-JSON gespeichert? --> Markdown
6. Sollen Tabellen echte Views oder eigene Datenbanken sein? --> echte Views

## Recommendation

Fuer V1:

- SQLite FTS5 als Pflicht.
- Volltext ueber Body + Properties + Aliases.
- gespeicherte Views fuer Tables.
- Graph nur lokal mit Filtern.
- Board als separate View mit Entity-Referenzen.
- Text als Block-JSON mit Export nach Markdown.

## Sources

- SQLite FTS5: https://sqlite.org/fts5.html
- PostgreSQL GIN: https://www.postgresql.org/docs/current/gin.html
- MediaWiki CirrusSearch: https://www.mediawiki.org/wiki/Extension:CirrusSearch
- Meilisearch: https://www.meilisearch.com/
- Typesense: https://typesense.org/
- Lunr.js: https://lunrjs.com/
- Cytoscape.js: https://js.cytoscape.org/
- React Flow: https://reactflow.dev/
- TanStack Table: https://tanstack.com/table/latest/docs/introduction
- ProseMirror: https://prosemirror.net/
