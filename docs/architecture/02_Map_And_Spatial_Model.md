# 02 Map And Spatial Model

## Goal

Das Tool soll keine Karten erstellen. Es soll Karten importieren, kalibrieren, annotieren und mit Lore verbinden.

Das ist ein anderer Produktfokus als Inkarnate oder Wonderdraft. Der Wert liegt nicht im Zeichnen, sondern in:

- Pins
- Regionen
- Labels
- Markern
- Relations
- Sichtbarkeit
- Massstab
- Session-Zustand
- Verknuepfung mit Entities

## Supported Map Inputs

### V1 Pflicht

| Format | Zweck |
|---|---|
| PNG | Standard fuer Battle-/Region-Maps |
| JPG/JPEG | grosse Karten, geringe Dateigroesse |
| WEBP | moderne Bildkompression |
| SVG | skalierbare Karten, falls vorhanden |
| PDF-Seite als Raster | optional spaeter, fuer Karten aus PDFs |

### V1 Optional / Importer

| Format | Zweck | Hinweis |
|---|---|---|
| Tiled JSON | Tilemaps / Leveldaten | offizielles Tiled JSON Format existiert |
| GeoJSON | echte geographische Features | gut fuer Vektor-Regionen, aber WGS84 ist fuer Fantasy nicht immer passend |
| MBTiles | grosse Tile-Sets offline | SQLite-basierter Tileset-Container |

## Do Not Overbuild

Nicht fuer V1:

- eigener Cartography-Editor
- Terrain-Stamps
- Brush-System
- prozedurale Weltgenerierung
- echtes GIS

V1 sollte ein sehr gutes Annotierungs- und Kalibrierungssystem sein.

## Internal Map Model

```json
{
  "id": "map_waterdeep_city",
  "title": "Waterdeep City Map",
  "asset_id": "res_waterdeep_png",
  "image": {
    "width_px": 6000,
    "height_px": 4200
  },
  "coordinate_system": {
    "origin": "top_left",
    "unit": "meter",
    "pixels_per_unit": 10.0
  },
  "calibration": {
    "method": "scale_line",
    "pixel_distance": 100,
    "world_distance": 1000,
    "world_unit": "meter"
  },
  "grid_overlays": [],
  "layers": []
}
```

## Coordinate Model

Alle Pins und Shapes bekommen interne Kartenkoordinaten. Keine gerundeten Rasterzellen als einzige Wahrheit.

```json
{
  "map_id": "map_waterdeep_city",
  "x": 1420.25,
  "y": 881.5,
  "coordinate_unit": "pixel"
}
```

Danach kann das Tool ableiten:

- Weltmeter
- Kilometer
- Grid-Zelle
- Label-Position
- Entfernung zwischen Punkten

## Calibration

Der Nutzer sollte den Massstab simpel setzen koennen:

1. Zwei Punkte auf der Karte anklicken.
2. Distanz eingeben: `10 km`, `500 m`, `30 ft`, `6 miles`.
3. Tool berechnet `pixels_per_world_unit`.

Beispiel:

```json
{
  "point_a": [100, 200],
  "point_b": [1100, 200],
  "world_distance": 10,
  "world_unit": "km"
}
```

Wenn 1000 px = 10 km, dann:

- 100 px = 1 km
- 1 px = 10 m

## Grid Overlay

Grid ist eine Ansicht, nicht die Ground Truth.

```json
{
  "id": "grid_1km",
  "type": "square",
  "spacing": 1,
  "unit": "km",
  "line_style": {
    "width": 1,
    "color": "#000000",
    "opacity": 0.25
  },
  "visible_by_default": false
}
```

Unterstuetzte Overlays:

| Grid Type | Use Case |
|---|---|
| square | Weltkarte, Dungeon, Stadt |
| hex | Reise, Exploration, Wilderness |
| radial | Einflussbereiche, Reichweiten |
| custom interval | 100 m, 1 km, 5 km, 10 km |

Wichtig: Das Raster muss stufenlos einstellbar sein. Presets helfen, aber der DM muss eigene Skalen definieren koennen.

### Grids im Session-Modus

einzelne Kästchen(Hexagons) können in der session aktiv/inaktiv geschlatet werden, so kann man einfach visuell den Weg verfolgen 
-> aktiv "border leuchtet auf"
-> auch modus mit multiselect, wo druhc masu gedrückt halten ganze "pfade" geziechent werdne können

## Pins, Regions, Labels

```json
{
  "id": "pin_silas_shop",
  "map_id": "map_waterdeep_city",
  "entity_id": "loc_silas_shop",
  "kind": "pin",
  "position": {"x": 3120.5, "y": 1198.25},
  "label": "Silas' Backroom",
  "visibility": {
    "default": "gm_only",
    "condition": "flags.arcane_battery_lead_discovered == true"
  }
}
```

Shapes:

```json
{
  "kind": "polygon",
  "points": [[100,100], [300,120], [280,260], [120,240]],
  "entity_id": "region_dock_ward"
}
```

## Bidirectional Map + Lore

Die Relation darf nicht nur im Map-Objekt stecken.

Empfohlen:

- Map Marker ist eine eigene Entity oder Resource.
- Marker referenziert Entity.
- Entity kann alle Marker abfragen.

```text
Location "Dock Ward"
  appears_on -> Waterdeep City Map
  has_marker -> polygon_dock_ward

Map "Waterdeep City Map"
  contains_marker -> polygon_dock_ward
  marker_links_to -> Location "Dock Ward"
```

Technisch kann das ueber eine Spatial Marker Table laufen:

```sql
map_markers(
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  entity_id TEXT,
  kind TEXT NOT NULL,
  geometry_json TEXT NOT NULL,
  style_json TEXT,
  visibility_json TEXT
)
```

## VTT Minimalism

Der Wunsch ist kein Foundry-Klon und kein Owlbear-Klon. Besser:

| Feature | V1? | Kommentar |
|---|---|---|
| Tokens | Ja, minimal | positionierte Marker mit Entity-Referenz |
| Fog of War | Spaeter | komplex, aber Visibility-Layer vorbereiten |
| Drawing | Ja, simpel | Linie, Kreis, Polygon, Text |
| Active Effects | Nur Tags/State | keine Rules Engine auf Karte erzwingen |
| Initiative | Nein | gehoert eher ins Rules/Session-Modul |
| Dynamic Lighting | Nein | hoher Aufwand, wenig Kernnutzen |

## Visibility on Maps

Map-Elemente sollten dieselbe Condition-Engine nutzen wie Session Pages.

Beispiel:

```json
{
  "show_if": {
    "and": [
      {"var": "session.flags.entered_warehouse"},
      {">=": [{"var": "session.timers.round"}, 3]}
    ]
  }
}
```

Damit funktionieren:

- versteckte Marker
- dynamische Labels
- player-facing Karten
- Session-triggered reveals
- Timer-basierte Hinweise

## Import Strategy

### Plain Images

1. Datei importieren.
2. Asset speichern.
3. Bildabmessungen lesen.
4. Nutzer kalibriert optional Massstab.
5. Nutzer erstellt Marker.

### Tiled JSON

Tiled kann Maps als JSON exportieren. Das ist interessant fuer:

- Tile-Layer
- Object-Layer
- Properties
- Collision/Region-Daten

Fuer dieses Tool waere Tiled JSON ein Importformat, nicht das interne Hauptformat.

### GeoJSON

GeoJSON ist ein Standard fuer geographische Features. Aber: Es nutzt WGS84/decimal degrees. Fuer Fantasy-Welten ohne Erde ist das oft falsche Semantik.

Empfehlung:

- GeoJSON als Import/Export fuer Vektor-Shapes zulassen.
- Intern eigene `local_map_coordinates` nutzen.

### MBTiles

MBTiles speichert tiled map data in SQLite. Das ist interessant, wenn riesige Karten performant offline angezeigt werden sollen.

Fuer V1 wahrscheinlich overkill, aber spaeter stark fuer:

- sehr grosse Weltkarten
- Zoom-Level
- mobile/offline Pakete

## Decision Questions

1. Soll ein Map Marker eine eigene Entity sein oder ein Sub-Objekt der Map? --> eigene Enttiy/Ressourcen-Verknüpfung
2. Muessen Marker versionierbar sein? nein
3. Werden Entfernungen nur 2D berechnet oder auch mit Hoehe/Elevation? --> Support für höhe sollte drin sein.wie wir das visuel darstellen sit zweitraning  vlt reicht ein "elevated"-Icon (pfeil nach obne und daneben die zahl wiviel meter)
4. Braucht V1 Hex-Grid oder reicht Square + gridless? --> Hex-grid wird schon oft verwendet, wenn nciht zu kompliziert, gerne direkt als V1. 
5. Sollen Maps player-facing exportiert werden koennen? --> ja definitiv, genr hier acuh je Session "versioniert" (stück für stück merh afugedeckt/visible)
6. Soll es "Scene Map" und "World Map" als unterschiedliche Modi geben? --> oft schränken Modi eher ein, als se helfen gern ein systme für alles, aber z.b. gibt es pro Modi 5-6 schnellasuwahl-tools. was man in diesem modus oft bruacht, aber über menüs sind alle  anderne tools acuh erriechbat

## Recommendation

Fuer V1:

- Plain image import zuerst.
- Intern Pixelkoordinaten + Kalibrierung.
- Marker, Labels, Shapes als eigene MapMarker Records.
- MapMarker referenziert Entity optional.
- Grid als View Overlay, nicht als Datenmodell.
- Conditions direkt auf Markern erlauben.
- Tiled JSON, GeoJSON, MBTiles nur als Import-/Roadmap-Themen.

## Sources

- Tiled JSON map format: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Tiled export formats: https://www.mapeditor.org/
- GeoJSON RFC 7946: https://datatracker.ietf.org/doc/html/rfc7946
- MBTiles specification: https://github.com/mapbox/mbtiles-spec
- Foundry Scene grid concepts: https://foundryvtt.com/article/scenes/
- Owlbear Rodeo SDK reference: https://docs.owlbear.rodeo/extensions/reference/
