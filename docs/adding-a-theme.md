# Ein eigenes Theme anlegen (ohne Quellcode)

Ein Theme ist ein **vollständiger Farb-Skin**: es darf **jeden Farb-Token** überschreiben (die ganze Palette, nicht nur den Akzent). Du legst dafür **eine JSON-Datei** in einen Ordner — beim nächsten App-Start taucht dein Theme automatisch im Theme-Picker auf (Einstellungen ⚙ → „Darstellung"). Kein Quellcode, kein Build.

> Zum Ausprobieren **bevor** du die Datei ablegst: `docs/theme-tester.html` per Doppelklick im Browser öffnen, JSON einfügen, live sehen.

---

## 1) Datei ablegen

Lege eine Datei `<name>.json` hier ab (eine Datei = ein Theme):

```
<App-Datenordner>/themes/<name>.json
```

Der App-Datenordner ist unter Windows:

```
%APPDATA%\WorldsAndBeyond\themes\
```

(Existiert der Ordner `themes` noch nicht, einfach anlegen.) Danach die App **neu starten**.

## 2) Was in die Datei gehört

| Feld | Pflicht | Werte |
|---|---|---|
| `id` | ja | eindeutig, nur Kleinbuchstaben/Ziffern/Bindestrich (`^[a-z0-9-]+$`) |
| `label` | ja | Anzeigename im Picker |
| `appearance` | ja | `"dark"` · `"light"` · `"both"` |
| `modeSupport` | ja | `"unified"` (eine Farbe für Bearbeiten **und** Spielen) · `"per-mode"` (eigener Akzent je Modus) |
| `"dark"` / `"light"` | je nach `appearance` | ein Block je unterstützter Erscheinung (`both` → **beide**) |

Jeder Erscheinungs-Block hat:

- **`palette`** *(optional)* — beliebige `--color-*`-Overrides. **Nicht** gesetzte Tokens **erben die Basis** (wie eine VS-Code-`colors`-Datei — du änderst nur, was du willst).
- **`accents`** *(Pflicht)* — die Akzentfarben als `{ accent, hover, on, text, soft }`:
  - bei `modeSupport: "per-mode"` → getrennt: `{ "edit": { … }, "play": { … } }`
  - bei `modeSupport: "unified"` → **flach**: `{ accent, hover, on, text, soft }`

Die fünf Accent-Felder werden gemappt auf `--mode-accent`, `-hover`, `-on`, `-text`, `-soft`.
`on` = Text/Icon **auf** der gefüllten Akzentfläche (Kontrast-Regel: auf hellem Akzent dunkel, auf sattem weiß, Ziel ≥ 4.5:1).

**Nur Farben sind themebar** — `--color-*` und die fünf Accents. **Nicht** themebar: Radien, Abstände und die **Geometrie** von Schatten (Pixel/Blur). Die Schatten-**Farbe** ist über `--color-shadow-panel` setzbar; die Pixel bleiben fix.

### Themebare `--color-*`-Tokens
`--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-strong`, `--color-accent-soft`, `--color-surface`, `--color-surface-alt`, `--color-surface-hover`, `--color-surface-active`, `--color-background`, `--color-border`, `--color-status-success`, `--color-status-warning`, `--color-status-failure`, `--color-status-muted`, `--color-on-accent`, `--color-scrim`, `--color-overlay-border`, `--color-shadow`, `--color-highlight`, `--color-layer-image`, `--color-layer-fog`, `--color-layer-token`, `--color-swatch-outline`, `--color-print-border`, `--color-focus-glow`, `--color-error-soft`, `--color-shadow-panel`.

(Ein unbekannter Token-Name macht die **Datei ungültig** — sie wird beim Start übersprungen, die anderen laden weiter. Eine `id`, die mit einem eingebauten Theme kollidiert — `default`, `teal` — wird ignoriert.)

---

## Beispiel A — `appearance: "dark"` + `modeSupport: "unified"`
Einfachster Fall: eine Farbwelt für beide Modi, nur dunkel.

```json
{
  "id": "carbon", "label": "Carbon",
  "appearance": "dark", "modeSupport": "unified",
  "dark": {
    "palette": { "--color-background": "#0d0d0f", "--color-surface": "#17171a", "--color-text": "#e6e6ea", "--color-border": "#2a2a30" },
    "accents": { "accent": "#8b8b93", "hover": "#a0a0a8", "on": "#0d0d0f", "text": "#c7c7cf", "soft": "rgba(139,139,147,0.16)" }
  }
}
```

## Beispiel B — `appearance: "both"` + `modeSupport: "unified"`
Eine Akzentfarbe für beide Modi, aber **eigener Dark- UND Light-Satz** (der Dark/Light-Umschalter wählt).

```json
{
  "id": "sepia", "label": "Sepia",
  "appearance": "both", "modeSupport": "unified",
  "dark": {
    "palette": { "--color-background": "#1c1712", "--color-surface": "#27201a", "--color-text": "#ece2d4" },
    "accents": { "accent": "#b5895c", "hover": "#c99e72", "on": "#1c1712", "text": "#d8b48a", "soft": "rgba(181,137,92,0.16)" }
  },
  "light": {
    "palette": { "--color-background": "#f5efe6", "--color-surface": "#fffdf8", "--color-text": "#2a2018" },
    "accents": { "accent": "#8a5a2b", "hover": "#734a22", "on": "#ffffff", "text": "#8a5a2b", "soft": "rgba(138,90,43,0.14)" }
  }
}
```

## Beispiel C — `appearance: "both"` + `modeSupport: "per-mode"`
Voll: Dark **und** Light × **getrennte** edit/play-Accents. Hier: Prep bleibt Rot, Live wird Violett.

```json
{
  "id": "amethyst", "label": "Amethyst",
  "appearance": "both", "modeSupport": "per-mode",
  "dark": {
    "palette": { "--color-background": "#160a26", "--color-surface": "#241236", "--color-text": "#e9e0f5", "--color-accent": "#a855f7" },
    "accents": {
      "edit": { "accent": "#e5484d", "hover": "#ef5a5f", "on": "#ffffff", "text": "#f0888b", "soft": "rgba(229,72,77,0.16)" },
      "play": { "accent": "#a855f7", "hover": "#b975f9", "on": "#1a0733", "text": "#d8b4fe", "soft": "rgba(168,85,247,0.16)" }
    }
  },
  "light": {
    "palette": { "--color-background": "#f6f2fb", "--color-surface": "#ffffff", "--color-text": "#241236", "--color-accent": "#7c3aed" },
    "accents": {
      "edit": { "accent": "#c1121f", "hover": "#a80f1a", "on": "#ffffff", "text": "#b3121f", "soft": "rgba(193,18,31,0.12)" },
      "play": { "accent": "#7c3aed", "hover": "#6d28d9", "on": "#ffffff", "text": "#7c3aed", "soft": "rgba(124,58,237,0.14)" }
    }
  }
}
```

> Die **vierte** Kombination (`appearance: "dark"`/`"light"` + `modeSupport: "per-mode"`) = Beispiel C mit nur **einem** Erscheinungs-Block. Ein Single-Appearance-Theme erzwingt seine Erscheinung; der Dark/Light-Umschalter ist dann deaktiviert.

---

## 3) Fertig

App neu starten → dein Theme steht im Picker (Einstellungen ⚙ → „Darstellung"). Die Auswahl wechselt live und bleibt über Neustarts erhalten. Optional den Anzeigenamen übersetzen: `theme.<id>` in `src/locales/{de,en}/common.json` (sonst greift `label`).
