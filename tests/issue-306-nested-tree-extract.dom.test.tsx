// @vitest-environment jsdom
// refactor(ui) 1/3: NestedTree — aus Pin-Baum extrahiert, Pin-Frontend unverändert (#306)
//
// Drag-Mechanik: onPointerDown → pointermove (document.elementFromPoint) → pointerup
// elementFromPoint liefert null in jsdom → vollständiger Drop-Pfad nicht testbar via
// Event-Simulation. Testbar: data-drop-path-Struktur, pointer-Cursor, Drag-Callbacks
// über simulierten pointerup mit manuellem elementFromPoint-Mock.
// Kein HTML5-dragstart, kein ↕-Button.

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NestedTree, fromPathStrings, fromParentId } from '../src/ui/NestedTree';
import type { NestedTreeNode } from '../src/ui/NestedTree';

const treeNodes: NestedTreeNode[] = [
  {
    id: 'f1', label: 'Städte', path: 'Städte', itemCount: 3,
    children: [
      { id: 'f2', label: 'Hauptstädte', path: 'Städte/Hauptstädte', itemCount: 1 },
    ],
  },
  { id: 'f3', label: 'Wälder', path: 'Wälder', itemCount: 0 },
];

// ── Kein ↕-Button ─────────────────────────────────────────────────────────────

describe('NestedTree — kein ↕-Button', () => {
  it('rendert keinen permanenten Verschieben-Button in der Zeile', () => {
    render(<NestedTree nodes={treeNodes} />);
    expect(screen.queryByRole('button', { name: /verschieben|↕/i })).not.toBeInTheDocument();
  });
});

// ── Drag-Struktur: data-drop-path + Pointer-Cursor ────────────────────────────

describe('NestedTree — Drag-Struktur (Pointer-Events)', () => {
  it('Ordner-Header tragen data-drop-path-Attribut', () => {
    render(<NestedTree nodes={treeNodes} />);
    const dropTargets = document.querySelectorAll('[data-drop-path]');
    // Mindestens Root-Container + Städte + Wälder
    expect(dropTargets.length).toBeGreaterThanOrEqual(3);
  });

  it('Root-Container hat data-drop-path="" (Drop auf Root-Ebene)', () => {
    const { container } = render(<NestedTree nodes={treeNodes} />);
    expect(container.querySelector('[data-drop-path=""]')).toBeTruthy();
  });

  it('Ordner-Header hat data-drop-path gleich dem Pfad-String', () => {
    render(<NestedTree nodes={treeNodes} />);
    expect(document.querySelector('[data-drop-path="Städte"]')).toBeTruthy();
    expect(document.querySelector('[data-drop-path="Wälder"]')).toBeTruthy();
  });

  it('Ordner-Header hat cursor:grab (visueller Drag-Hinweis, kein extra-Button)', () => {
    render(<NestedTree nodes={treeNodes} />);
    const staedteHeader = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    expect(staedteHeader?.style.cursor).toBe('grab');
  });

  it('onPointerDown auf Ordner-Header wirft nicht (Drag startet sauber)', () => {
    render(<NestedTree nodes={treeNodes} onFolderMove={vi.fn()} />);
    const header = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    expect(() => fireEvent.pointerDown(header)).not.toThrow();
  });

  it('onItemMove wird nach pointerdown→pointerup mit gefundenem Drop-Ziel aufgerufen', () => {
    const onItemMove = vi.fn();
    render(<NestedTree nodes={treeNodes} onItemMove={onItemMove} />);

    const header = document.querySelector('[data-drop-path="Wälder"]') as HTMLElement;
    const dropTarget = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;

    // Mock elementFromPoint: simulates the pointer landing on "Städte"
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(dropTarget);

    fireEvent.pointerDown(header, { clientX: 100, clientY: 100 });
    fireEvent(document, new PointerEvent('pointerup', { clientX: 200, clientY: 100, bubbles: true }));

    vi.restoreAllMocks();

    expect(onItemMove).toHaveBeenCalledWith(expect.any(String), 'Städte');
  });

  it('onFolderMove wird nach Ordner-Drag auf neues Ziel aufgerufen', () => {
    const onFolderMove = vi.fn();
    render(<NestedTree nodes={treeNodes} onFolderMove={onFolderMove} />);

    const waldHeader = document.querySelector('[data-drop-path="Wälder"]') as HTMLElement;
    const staedteHeader = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(staedteHeader);

    fireEvent.pointerDown(waldHeader, { clientX: 100, clientY: 100 });
    fireEvent(document, new PointerEvent('pointerup', { clientX: 200, clientY: 100, bubbles: true }));

    vi.restoreAllMocks();

    expect(onFolderMove).toHaveBeenCalledWith('Wälder', 'Städte/Wälder');
  });

  it('Ordner-Drag auf sich selbst ruft onFolderMove NICHT auf', () => {
    const onFolderMove = vi.fn();
    render(<NestedTree nodes={treeNodes} onFolderMove={onFolderMove} />);

    const staedteHeader = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(staedteHeader);

    fireEvent.pointerDown(staedteHeader, { clientX: 100, clientY: 100 });
    fireEvent(document, new PointerEvent('pointerup', { clientX: 100, clientY: 100, bubbles: true }));

    vi.restoreAllMocks();
    expect(onFolderMove).not.toHaveBeenCalled();
  });
});

// ── Collapse / Expand ─────────────────────────────────────────────────────────

describe('NestedTree — Collapse/Expand', () => {
  it('rendert Top-Level-Labels', () => {
    render(<NestedTree nodes={treeNodes} />);
    expect(screen.getByText('Städte')).toBeInTheDocument();
    expect(screen.getByText('Wälder')).toBeInTheDocument();
  });

  it('Kinder sind standardmäßig eingeklappt', () => {
    render(<NestedTree nodes={treeNodes} />);
    expect(screen.queryByText('Hauptstädte')).not.toBeInTheDocument();
  });

  it('Expand-Button zeigt ▶ wenn eingeklappt', () => {
    render(<NestedTree nodes={treeNodes} />);
    const staedteSection = document.querySelector('[data-drop-path="Städte"]')!;
    expect(within(staedteSection as HTMLElement).getByText(/▶/)).toBeInTheDocument();
  });

  it('Klick auf Toggle zeigt Kinder und ändert Pfeil auf ▼', () => {
    render(<NestedTree nodes={treeNodes} />);
    const toggleBtn = screen.getByRole('button', { name: /städte/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Hauptstädte')).toBeInTheDocument();
    expect(document.querySelector('[data-drop-path="Städte"]')?.textContent).toMatch(/▼/);
  });

  it('zweiter Klick klappt wieder ein', () => {
    render(<NestedTree nodes={treeNodes} />);
    const btn = screen.getByRole('button', { name: /städte/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText('Hauptstädte')).not.toBeInTheDocument();
  });
});

// ── Zähler (itemCount) ────────────────────────────────────────────────────────

describe('NestedTree — Zähler', () => {
  it('zeigt itemCount-Badge für Knoten mit Zähler', () => {
    render(<NestedTree nodes={treeNodes} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // Städte
  });
});

// ── Suche ─────────────────────────────────────────────────────────────────────

describe('NestedTree — Suche', () => {
  it('zeigt Suchfeld wenn searchable=true', () => {
    render(<NestedTree nodes={treeNodes} searchable />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('filtert Knoten nach Suchbegriff', () => {
    render(<NestedTree nodes={treeNodes} searchable />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Wälder' } });
    expect(screen.getByText('Wälder')).toBeInTheDocument();
    expect(screen.queryByText('Städte')).not.toBeInTheDocument();
  });

  it('leert man die Suche, erscheinen alle Knoten wieder', () => {
    render(<NestedTree nodes={treeNodes} searchable />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'Wälder' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Städte')).toBeInTheDocument();
    expect(screen.getByText('Wälder')).toBeInTheDocument();
  });
});

// ── Adapter: fromPathStrings ───────────────────────────────────────────────────

describe('fromPathStrings Adapter', () => {
  it('baut Hierarchie aus Pfad-Strings', () => {
    const items = [
      { id: 'p1', path: 'Städte', label: 'Städte' },
      { id: 'p2', path: 'Städte/Hauptstädte', label: 'Hauptstädte' },
    ];
    const nodes = fromPathStrings(items);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].path).toBe('Städte');
    expect(nodes[0].children?.[0].path).toBe('Städte/Hauptstädte');
  });
});

// ── Adapter: fromParentId ─────────────────────────────────────────────────────

describe('fromParentId Adapter', () => {
  it('baut Hierarchie aus parent_id-Referenzen', () => {
    const items = [
      { id: 'f1', parent_id: null, label: 'Ordner A' },
      { id: 'f2', parent_id: 'f1', label: 'Unterordner' },
    ];
    const nodes = fromParentId(items);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].children?.[0].label).toBe('Unterordner');
  });

  it('überträgt itemCount', () => {
    const items = [{ id: 'f1', parent_id: null, label: 'Maps', itemCount: 5 }];
    expect(fromParentId(items)[0].itemCount).toBe(5);
  });
});
