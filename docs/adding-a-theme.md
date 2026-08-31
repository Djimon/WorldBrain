# Ein eigenes Theme anlegen (in 3 Handgriffen)

Ein Theme legt fest, welche **Akzentfarbe** die zwei Shell-Modi tragen — **Prep** (Bearbeiten) und **Live** (Spielen). Der Rest (Text, Flächen, Ränder) kommt aus der Erscheinung *dark/light* und bleibt unangetastet.

Beispiel: ein Theme **„Amethyst"** — Prep bleibt Rot, Live wird Violett. Dark-only (einfachster Fall).

---

## 1) Theme in der Registry deklarieren

Datei: `src/styles/theme-registry.ts` — neuen `ThemeDef` anlegen und in `THEMES` eintragen.

```ts
const AMETHYST_THEME: ThemeDef = {
  id: 'amethyst',
  labelKey: 'theme.amethyst',
  defaultLabel: 'Amethyst',
  modeSupport: 'per-mode',      // eigener Akzent je Modus (edit ≠ play)
  appearanceSupport: 'dark',    // nur Dark — Dark/Light-Umschalter wird ausgeblendet
  tokens: {
    edit: { // Prep bleibt Rot (Konvention)
      '--mode-accent': '#e5484d', '--mode-accent-hover': '#ef5a5f', '--mode-accent-on': '#ffffff',
      '--mode-accent-text': '#f0888b', '--mode-accent-soft': 'rgba(229,72,77,0.16)',
    },
    play: { // Live = Violett
      '--mode-accent': '#7c3aed', '--mode-accent-hover': '#8b5cf6', '--mode-accent-on': '#ffffff',
      '--mode-accent-text': '#c4b5fd', '--mode-accent-soft': 'rgba(124,58,237,0.16)',
    },
  },
};

const THEMES: Record<string, ThemeDef> = {
  [DEFAULT_THEME.id]: DEFAULT_THEME,
  [TEAL_THEME.id]: TEAL_THEME,
  [AMETHYST_THEME.id]: AMETHYST_THEME,   // ← diese Zeile
};
```

## 2) Die Akzentfarben als CSS-Blöcke hinterlegen

Datei: `src/styles/tokens.css` — zwei Blöcke, gekeyt auf `data-theme='<id>'`:

```css
/* Amethyst-Theme (#385-Muster): per-mode, dark-only. */
:root[data-theme='amethyst'] {              /* edit / Prep-Rot */
  --mode-accent:       #e5484d;
  --mode-accent-hover: #ef5a5f;
  --mode-accent-on:    #ffffff;
  --mode-accent-text:  #f0888b;
  --mode-accent-soft:  rgba(229, 72, 77, 0.16);
}
:root[data-theme='amethyst'][data-mode='play'] {   /* play / Live-Violett */
  --mode-accent:       #7c3aed;
  --mode-accent-hover: #8b5cf6;
  --mode-accent-on:    #ffffff;
  --mode-accent-text:  #c4b5fd;
  --mode-accent-soft:  rgba(124, 58, 237, 0.16);
}
```

> Die Werte in Registry (Schritt 1) und CSS (Schritt 2) müssen gleich sein: die Registry ist die Daten-/Vorschau-Quelle (Swatch im Picker), das CSS ist die Laufzeit.

## 3) Fertig

Der **Theme-Picker** (Einstellungen ⚙ → „Darstellung") listet neue Themes **automatisch** über `listThemes()` — nichts weiter zu verdrahten. Auswahl wechselt den Akzent live, ohne Reload.

Optional den Anzeigenamen übersetzen: `theme.amethyst` in `src/locales/de/common.json` + `en/common.json` (der Inline-Default „Amethyst" greift sonst).

---

## Achsen kurz erklärt

- **`modeSupport`**
  - `per-mode` — edit und play haben eigene Akzente (wie oben; beide CSS-Blöcke).
  - `unified` — eine Farbe für beide Modi: **nur** den `edit`-Block anlegen (kein `[data-mode='play']`-Block), und in der Registry nur `tokens.edit` setzen.
- **`appearanceSupport`**
  - `dark` (oder `light`) — Single-Appearance: erzwingt die Erscheinung, der Dark/Light-Umschalter ist deaktiviert. **Einfachster Fall** (2 Blöcke).
  - `both` — eigener Dark- **und** Light-Satz. Dann die Blöcke zusätzlich nach Erscheinung staffeln (`:root[data-appearance='light'][data-theme='<id>']…` bzw. `…[data-appearance='dark']…`) und Light **separat** mit WCAG-AA-Kontrast autorisieren (nicht aus dem Dark-Hue ableiten). Siehe das Default-Theme in `tokens.css` als Vorlage.

**Kontrast-Faustregel:** `--mode-accent-on` ist der Text/Icon **auf** der gefüllten Akzentfläche — bei hellen Akzenten (Amber/Teal) dunkler Vordergrund, bei satten (Rot/Violett) Weiß. Ziel: ≥ 4.5:1.
