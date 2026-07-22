// @vitest-environment jsdom
// Characterization tests für NestedTree (aus Pin-Baum extrahiert, #306)
// Bilden das heutige Verhalten ab — nicht anfassen nach der Extraktion.

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NestedTree, fromPathStrings, fromParentId } from '../src/ui/NestedTree';
import type { TreeNode, TreeItem } from '../src/ui/NestedTree';

// jsdom does not implement elementFromPoint as a real property; repeated
// vi.spyOn/restoreAllMocks cycles on a missing property break. Stub once.
if (!document.elementFromPoint) {
  Object.defineProperty(document, 'elementFromPoint', { value: () => null, writable: true, configurable: true });
}

// ── Testdaten ─────────────────────────────────────────────────────────────────

const item1: TreeItem = { id: 'pin1', label: 'Stadttor' };
const item2: TreeItem = { id: 'pin2', label: 'Marktplatz' };
const item3: TreeItem = { id: 'pin3', label: 'Burg' };

const root: TreeNode[] = [
  {
    path: 'Städte',
    name: 'Städte',
    items: [item1, item2],
    children: [
      { path: 'Städte/Hauptstädte', name: 'Hauptstädte', items: [item3], children: [] },
    ],
  },
  { path: 'Wälder', name: 'Wälder', items: [], children: [] },
];

const ungrouped: TreeItem[] = [{ id: 'pin4', label: 'Freier Pin' }];

const renderItem = (item: TreeItem) => <span>{item.label}</span>;

// ── Kein permanenter ↕-Verschieben-Button ─────────────────────────────────────

describe('NestedTree — kein ↕-Button', () => {
  it('rendert keinen permanenten Verschieben-Button pro Zeile', () => {
    render(<NestedTree root={root} ungrouped={ungrouped} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /verschieben|↕/i })).not.toBeInTheDocument();
  });
});

// ── Ordner standardmäßig OFFEN ───────────────────────────────────────────────

describe('NestedTree — Ordner offen by default', () => {
  it('Kinder sind standardmäßig sichtbar (offen)', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    expect(screen.getByText('Stadttor')).toBeInTheDocument();
    expect(screen.getByText('Hauptstädte', { exact: false })).toBeInTheDocument();
  });

  it('Klick auf Ordner klappt ihn ein', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    const header = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    fireEvent.click(header);
    expect(screen.queryByText('Stadttor')).not.toBeInTheDocument();
    expect(document.querySelector('[data-drop-path="Städte"]')?.textContent).toMatch(/▶/);
  });

  it('zweiter Klick klappt wieder auf', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    const header = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    fireEvent.click(header);
    fireEvent.click(header);
    expect(screen.getByText('Stadttor')).toBeInTheDocument();
  });

  it('offener Ordner zeigt ▼-Pfeil', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    const header = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    expect(within(header).getByText(/▼/)).toBeInTheDocument();
  });
});

// ── Drag-Struktur: data-drop-path + Pointer-Cursor ────────────────────────────

describe('NestedTree — Drag-Struktur', () => {
  it('Root-Container hat data-drop-path=""', () => {
    const { container } = render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    expect(container.querySelector('[data-drop-path=""]')).toBeTruthy();
  });

  it('Ordner-Header hat data-drop-path gleich Pfad-String', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    expect(document.querySelector('[data-drop-path="Städte"]')).toBeTruthy();
    expect(document.querySelector('[data-drop-path="Wälder"]')).toBeTruthy();
    expect(document.querySelector('[data-drop-path="Städte/Hauptstädte"]')).toBeTruthy();
  });

  it('Ordner-Header hat cursor:grab', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    const header = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    expect(header.style.cursor).toBe('grab');
  });

  it('onPointerDown auf Ordner-Header wirft nicht', () => {
    render(<NestedTree root={root} onFolderMove={vi.fn()} onItemMove={vi.fn()} renderItem={renderItem} />);
    const header = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    expect(() => fireEvent.pointerDown(header)).not.toThrow();
  });

  it('onItemMove nach Item-Drag auf Ziel', () => {
    const onItemMove = vi.fn();
    render(<NestedTree root={root} ungrouped={ungrouped} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={onItemMove} />);

    const itemEl = screen.getByText('Freier Pin').closest('[role="button"]') as HTMLElement;
    const dropTarget = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(dropTarget);
    fireEvent.pointerDown(itemEl, { clientX: 10, clientY: 10 });
    fireEvent(document, new PointerEvent('pointermove', { clientX: 200, clientY: 100, bubbles: true }));
    fireEvent(document, new PointerEvent('pointerup', { clientX: 200, clientY: 100, bubbles: true }));
    vi.restoreAllMocks();

    expect(onItemMove).toHaveBeenCalledWith('pin4', 'Städte');
  });

  it('onFolderMove nach Ordner-Drag auf neues Ziel', () => {
    const onFolderMove = vi.fn();
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={onFolderMove} onItemMove={vi.fn()} />);

    const waldHeader = document.querySelector('[data-drop-path="Wälder"]') as HTMLElement;
    const staedteHeader = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(staedteHeader);
    fireEvent.pointerDown(waldHeader, { clientX: 100, clientY: 100 });
    fireEvent(document, new PointerEvent('pointermove', { clientX: 200, clientY: 100, bubbles: true }));
    fireEvent(document, new PointerEvent('pointerup', { clientX: 200, clientY: 100, bubbles: true }));
    vi.restoreAllMocks();

    expect(onFolderMove).toHaveBeenCalledWith('Wälder', 'Städte/Wälder');
  });

  it('Ordner-Drag auf sich selbst ruft onFolderMove NICHT auf', () => {
    const onFolderMove = vi.fn();
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={onFolderMove} onItemMove={vi.fn()} />);

    const staedteHeader = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(staedteHeader);
    fireEvent.pointerDown(staedteHeader, { clientX: 100, clientY: 100 });
    fireEvent(document, new PointerEvent('pointermove', { clientX: 100, clientY: 100, bubbles: true }));
    fireEvent(document, new PointerEvent('pointerup', { clientX: 100, clientY: 100, bubbles: true }));
    vi.restoreAllMocks();

    expect(onFolderMove).not.toHaveBeenCalled();
  });
});

// ── Zähler (itemCount) ────────────────────────────────────────────────────────

describe('NestedTree — Zähler', () => {
  it('zeigt rekursiven Zähler pro Ordner', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    const staedteHeader = document.querySelector('[data-drop-path="Städte"]') as HTMLElement;
    // Städte hat 2 eigene Items + 1 in Hauptstädte = 3
    expect(within(staedteHeader).getByText('3')).toBeInTheDocument();
  });
});

// ── Suche ─────────────────────────────────────────────────────────────────────

describe('NestedTree — Suche', () => {
  it('zeigt Suchfeld wenn searchable=true', () => {
    render(<NestedTree root={root} renderItem={renderItem} searchable
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('filtert Items nach Suchbegriff', () => {
    render(<NestedTree root={root} renderItem={renderItem} searchable
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Burg' } });
    expect(screen.getByText('Burg')).toBeInTheDocument();
    expect(screen.queryByText('Stadttor')).not.toBeInTheDocument();
  });

  it('leert Suche → alle Knoten wieder sichtbar', () => {
    render(<NestedTree root={root} renderItem={renderItem} searchable
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'Burg' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Stadttor')).toBeInTheDocument();
    expect(screen.getByText('Burg')).toBeInTheDocument();
  });
});

// ── Neuer Ordner Button ────────────────────────────────────────────────────────

describe('NestedTree — Neuer Ordner', () => {
  it('zeigt 📁+-Button wenn onCreateFolder vorhanden', () => {
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} onCreateFolder={vi.fn()} />);
    expect(screen.getByTitle('Neuer Ordner')).toBeInTheDocument();
  });

  it('onCreateFolder wird mit Eingabe aufgerufen', () => {
    const onCreate = vi.fn();
    render(<NestedTree root={root} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} onCreateFolder={onCreate} />);
    fireEvent.click(screen.getByTitle('Neuer Ordner'));
    const input = screen.getByPlaceholderText('Ordnername…');
    fireEvent.change(input, { target: { value: 'Berge' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledWith('Berge');
  });
});

// ── Ungrouped Items ────────────────────────────────────────────────────────────

describe('NestedTree — Ungrouped Items', () => {
  it('zeigt ungrouped Items ohne Ordner', () => {
    render(<NestedTree root={[]} ungrouped={ungrouped} renderItem={renderItem}
      onFolderMove={vi.fn()} onItemMove={vi.fn()} />);
    expect(screen.getByText('Freier Pin')).toBeInTheDocument();
  });
});

// ── Adapter: fromPathStrings ───────────────────────────────────────────────────

describe('fromPathStrings Adapter', () => {
  it('baut Hierarchie aus Pfad-Strings', () => {
    const items = [
      { id: 'p1', groupPath: 'Städte', label: 'Stadttor' },
      { id: 'p2', groupPath: 'Städte/Hauptstädte', label: 'Dom' },
    ];
    const { root: r, ungrouped: u } = fromPathStrings(items);
    expect(r).toHaveLength(1);
    expect(r[0].path).toBe('Städte');
    expect(r[0].children[0].path).toBe('Städte/Hauptstädte');
    expect(u).toHaveLength(0);
  });

  it('leere groupPath → ungrouped', () => {
    const items = [{ id: 'p1', groupPath: '', label: 'Frei' }];
    const { root: r, ungrouped: u } = fromPathStrings(items);
    expect(r).toHaveLength(0);
    expect(u).toHaveLength(1);
    expect(u[0].id).toBe('p1');
  });

  it('explizite Ordnerpfade erzeugen leere Ordner', () => {
    const { root: r } = fromPathStrings([], ['Leerorner']);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Leerorner');
    expect(r[0].items).toHaveLength(0);
  });
});

// ── Adapter: fromParentId ─────────────────────────────────────────────────────

describe('fromParentId Adapter', () => {
  it('baut Hierarchie aus parent_id-Referenzen', () => {
    const folders = [
      { id: 'f1', parent_id: null, label: 'Ordner A' },
      { id: 'f2', parent_id: 'f1', label: 'Unterordner' },
    ];
    const nodes = fromParentId(folders);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].children[0].name).toBe('Unterordner');
  });

  it('überträgt itemCount als items-Platzhalter', () => {
    const folders = [{ id: 'f1', parent_id: null, label: 'Maps', itemCount: 5 }];
    expect(fromParentId(folders)[0].items).toHaveLength(5);
  });
});
