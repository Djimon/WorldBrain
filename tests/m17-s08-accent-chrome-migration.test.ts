// @vitest-environment node
// M17-S08 (#391): Akzent-Chrome auf --mode-accent migrieren (ein Accent-System,
// kein Rest-Rot). Die interaktive Akzent-Chrome (Auswahl/Selektion, aktive Nav,
// Focus-Ring, Map-/Token-Selektion, Akzent-Text …) zieht ihre Farbe nicht mehr
// aus der modus-INVARIANTEN Familie `--color-accent*`/`--color-surface-active`,
// sondern aus den modus-GEGATETEN `--mode-accent*`-Tokens — dadurch folgt sie
// automatisch dem aktiven Shell-Modus (edit=Rot, play=Amber/Teal).
//
// Der EIGENTLICHE Flip-Beweis (migrierte Chrome löst edit≠play unterschiedliche
// Akzente auf, echte CSS gemountet) liegt in `tests/m17-s08-accent-chrome-flip.dom.test.tsx`.
// Hier: Positiv-Bindung der zentralen Selektoren + ein Absence-Guard, der über ALLE
// CSS-Dateien (Glob) läuft — eine neue Datei mit Rest-`--color-accent*`-Chrome wird
// dadurch ebenfalls gefangen.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Glob-Ersatz: alle .css unter src/styles/** und src/ui/** rekursiv einsammeln —
// keine fixe Dateiliste, damit neue CSS-Flächen automatisch abgedeckt sind.
function walkCss(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkCss(p, out);
    else if (name.endsWith('.css')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
const ALL_CSS = [...walkCss('src/styles'), ...walkCss('src/ui')];

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
  it('KEINE CSS-Fläche (Glob über src/styles + src/ui) konsumiert noch --color-accent*/--color-surface-active', () => {
    const offenders: string[] = [];
    for (const f of ALL_CSS) {
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
    // Quell-Beleg; der COMPUTED-Flip-Beweis (edit≠play am gemounteten Element) liegt
    // in tests/m17-s08-accent-chrome-flip.dom.test.tsx.
    expect(src).toMatch(/\[data-mode='play'\][\s\S]*?--mode-accent\s*:/);
  });
});
