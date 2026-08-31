// @vitest-environment node
// M17-S08 (#391): Akzent-Chrome auf --mode-accent migrieren (ein Accent-System,
// kein Rest-Rot). Die interaktive Akzent-Chrome (Auswahl/Selektion, aktive Nav,
// Focus-Ring, Map-/Token-Selektion, Akzent-Text …) zieht ihre Farbe nicht mehr
// aus der modus-INVARIANTEN Familie `--color-accent*`/`--color-surface-active`,
// sondern aus den modus-GEGATETEN `--mode-accent*`-Tokens — dadurch folgt sie
// automatisch dem aktiven Shell-Modus (edit=Rot, play=Amber/Teal).
//
// jsdom rechnet keine CSS-Kaskade aus Stylesheets aus (vgl. m17-s03-mount).
// Der Moduswechsel edit⟷play → Akzentwechsel ist zweistufig bewiesen:
//   (a) `tests/m17-s03-mode-accent-mount.dom.test.tsx` — data-mode flippt real,
//   (b) hier + `m17-s03-mode-accent-tokens` — die --mode-accent*-Tokens hängen an
//       data-mode/-theme, und die Chrome-Selektoren binden an eben diese Tokens.
// Zusammen: Chrome ist an data-mode gebunden → wechselt mit dem Modus.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Alle CSS-Flächen, deren Akzent-Chrome migriert wurde (+ die Primitives-Vorlage).
const MIGRATED_CSS = [
  'src/ui/primitives.css',
  'src/ui/graph.css',
  'src/styles/base.css',
  'src/styles/components/maps.css',
  'src/styles/components/maps-panels.css',
  'src/styles/components/entities.css',
  'src/styles/components/calendar.css',
  'src/styles/components/calendar-extras.css',
  'src/styles/components/audio.css',
  'src/styles/components/pickers.css',
  'src/styles/components/search.css',
  'src/styles/components/split-view.css',
  'src/styles/components/shell.css',
  'src/styles/components/play-cockpit-map.css',
];

const read = (f: string) => readFileSync(f, 'utf-8');

describe('M17-S08 Akzent-Chrome bindet an --mode-accent (positiv)', () => {
  it('primitives: selektierte Listenzeile nutzt den Modus-Akzent', () => {
    const src = read('src/ui/primitives.css');
    const block = src.slice(src.indexOf(".ui-list-row[data-selected]"));
    expect(block).toMatch(/border-left-color:\s*var\(--mode-accent\)/);
    expect(block).toMatch(/var\(--mode-accent\)\s*15%/);
  });

  it('primitives: selektierter Chip füllt mit Modus-Akzent + Modus-Vordergrund', () => {
    const src = read('src/ui/primitives.css');
    const block = src.slice(src.indexOf('.ui-chip[data-selected]'));
    expect(block).toMatch(/background:\s*var\(--mode-accent\)/);
    // Vordergrund auf gefülltem Akzent = --mode-accent-on (Weiß auf Rot, DUNKEL
    // auf Amber/Teal) — NICHT das immer-weiße --color-on-accent.
    expect(block).toMatch(/color:\s*var\(--mode-accent-on\)/);
  });

  it('map: selektierter Token-Ring nutzt den Modus-Akzent', () => {
    const src = read('src/styles/components/maps.css');
    const block = src.slice(src.indexOf('.map-token--selected .map-token__ring'));
    expect(block).toMatch(/var\(--mode-accent\)/);
  });

  it('shell: aktives Nav-Item füllt mit Modus-Akzent + Modus-Vordergrund', () => {
    const src = read('src/styles/components/shell.css');
    const block = src.slice(src.indexOf(".workspace-shell__sidebar button[aria-pressed='true']"));
    expect(block).toMatch(/background:\s*var\(--mode-accent\)/);
    expect(block).toMatch(/color:\s*var\(--mode-accent-on\)/);
  });

  it('map: eingeklappter Sidebar-Tab-Hover nutzt Modus-Akzent-Text (kein Rest-Rot)', () => {
    const src = read('src/styles/components/maps.css');
    expect(src).toMatch(/\.map-side-collapsed__tab:hover\s*\{\s*color:\s*var\(--mode-accent-text\)/);
  });
});

describe('M17-S08 Guard: keine --color-accent*-Chrome mehr (Regressionsnetz)', () => {
  it('keine migrierte CSS-Fläche konsumiert noch --color-accent*/--color-surface-active', () => {
    const offenders: string[] = [];
    for (const f of MIGRATED_CSS) {
      const src = read(f);
      for (const [i, line] of src.split('\n').entries()) {
        if (/var\(--color-accent(-strong|-soft)?\)|var\(--color-surface-active\)/.test(line)) {
          offenders.push(`${f}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('inline-Styles in Map-Komponenten nutzen --mode-accent statt --color-accent', () => {
    for (const f of ['src/ui/MapTokenLayer.tsx', 'src/ui/MapViewer.tsx', 'src/ui/NestedTree.tsx']) {
      expect(read(f)).not.toMatch(/var\(--color-accent[,)]/);
    }
  });
});

describe('M17-S08 Mechanismus: --mode-accent ist modus-gegatet (schaltet mit dem Modus)', () => {
  it('tokens.css belegt --mode-accent im Play-Modus separat', () => {
    const src = read('src/styles/tokens.css');
    // Es existiert ein play-Block, der --mode-accent neu setzt → migrierte Chrome
    // löst im Play-Modus einen anderen Akzent auf als im Edit-Modus.
    expect(src).toMatch(/\[data-mode='play'\][\s\S]*?--mode-accent\s*:/);
  });
});
