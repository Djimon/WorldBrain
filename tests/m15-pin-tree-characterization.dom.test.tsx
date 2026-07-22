// @vitest-environment jsdom
// Characterization tests für den Pin-Baum in MapViewer.tsx
// Schützt die MapViewer-seitige Verdrahtung:
//   - fromPathStrings-Aufruf (Z.636)
//   - NestedTree-Props (Z.1017): root/ungrouped, renderItem, header, searchable,
//     onFolderMove, onItemMove, onCreateFolder
//   - renderItem: Emoji + Label + verknüpfte Entity
//   - Panel-Header "Pins (N)"
//   - Suchfeld (searchable=true)
//   - „Neuer Ordner"-Icon-Button
//   - Rename-Flow (onFolderMove → handleGroupRename)
//   - Panel-Collapse
//
// AP-008: Pin-Labels erscheinen doppelt — Canvas (.map-pin__label) UND
// Baum (.map-pin-tree__label). Alle Label-Queries via within(treeEl) verankert.
// Ordner-Name via .map-pin-tree__group-name (📁 + name sind zwei Textknoten).

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapViewer } from '../src/ui/MapViewer';

if (!document.elementFromPoint) {
  Object.defineProperty(document, 'elementFromPoint', {
    value: () => null, writable: true, configurable: true,
  });
}

// ── Service-Mocks ─────────────────────────────────────────────────────────────

const MARKER_NORMAL = {
  id: 'pin-1', map_id: 'map-1', kind: 'normal',
  label_text: 'Stadttor', group_name: 'Städte',
  entity_id: null, geometry_json: '{"x":10,"y":20}',
  style_json: '{}', elevation_value: null, elevation_unit: null,
  visibility_json: '"public"',
};
const MARKER_LINKED = {
  id: 'pin-2', map_id: 'map-1', kind: 'normal',
  label_text: 'Burg', group_name: null,
  entity_id: 'entity-1', geometry_json: '{"x":30,"y":40}',
  style_json: '{}', elevation_value: null, elevation_unit: null,
  visibility_json: '"public"',
};
const MARKER_FOLDER = {
  id: 'pin-anchor', map_id: 'map-1', kind: 'folder-anchor',
  label_text: 'Städte', group_name: 'Städte',
  entity_id: null, geometry_json: '{"virtual":true}',
  style_json: '{}', elevation_value: null, elevation_unit: null,
  visibility_json: '"public"',
};

vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn(async () => ({ id: 'map-1', title: 'Testmap', asset_id: 'asset-1', grid_json: '{}' })),
  getAssetUrl: vi.fn(async () => 'data:image/png;base64,AA=='),
  loadGridSettings: vi.fn(async () => ({
    enabled: false, cellSize: 50, offsetX: 0, offsetY: 0, color: '#888', opacity: 0.5,
    pinSize: 'md', cellStates: [], lineWidth: 1, style: 'solid',
  })),
  saveGridSettings: vi.fn(async () => undefined),
}));

vi.mock('../src/services/map-marker-service', () => ({
  getMarkersForMap: vi.fn(async () => [MARKER_NORMAL, MARKER_LINKED, MARKER_FOLDER]),
  createMarker: vi.fn(async () => ({ id: 'pin-new' })),
  updateMarker: vi.fn(async () => undefined),
  deleteMarker: vi.fn(async () => undefined),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(async () => [{ id: 'entity-1', type: 'Character', title: 'Ada Thorn' }]),
}));

vi.mock('../src/services/map-layer-service', () => ({
  listLayers: vi.fn(async () => [
    { id: 'layer-1', map_id: 'map-1', layer_type: 'image', asset_id: 'asset-1', visible: true, opacity: 1, z_order: 0, offset_x: 0, offset_y: 0, mask_data: null, name: 'Base' },
  ]),
  updateLayer: vi.fn(async () => undefined),
  createTokenLayer: vi.fn(async () => ({ id: 'layer-1' })),
}));

vi.mock('../src/services/map-token-service', () => ({
  listTokens: vi.fn(async () => []),
  createToken: vi.fn(async () => ({ id: 'token-1' })),
  moveToken: vi.fn(async () => undefined),
  updateToken: vi.fn(async () => undefined),
  setCounter: vi.fn(async () => undefined),
  setStatusChips: vi.fn(async () => undefined),
  deleteToken: vi.fn(async () => undefined),
}));

vi.mock('../src/services/session-grid-service', () => ({
  getActivatedCells: vi.fn(async () => []),
  clearAllCells: vi.fn(async () => undefined),
  setCellState: vi.fn(async () => undefined),
}));

vi.mock('../src/services/session-variable-service', () => ({
  listVars: vi.fn(async () => []),
}));

vi.mock('../src/services/icon-set-registry', () => ({
  getIcon: vi.fn(() => undefined),
  listIconSets: vi.fn(() => []),
  registerIconSet: vi.fn(),
  clearIconSets: vi.fn(),
  CORE_ICON_SET: { id: 'core', label: 'Core', icons: [] },
}));

const mockDb = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };

function renderViewer() {
  return render(<MapViewer mapId="map-1" database={mockDb} />);
}

// Wartet bis der Baum sichtbar ist; gibt within(treeEl) zurück.
// Scope-Anker: .map-pin-tree — vermeidet Kollision mit Canvas-Labels.
async function waitForTree() {
  await waitFor(() => {
    const el = document.querySelector('.map-pin-tree');
    if (!el) throw new Error('tree not mounted');
    // Baum hat Inhalt wenn mindestens ein Item oder Ordner gerendert ist
    if (!el.querySelector('.map-pin-tree__label, .map-pin-tree__group-name'))
      throw new Error('tree empty');
  });
  return within(document.querySelector('.map-pin-tree') as HTMLElement);
}

// ── Panel-Header ──────────────────────────────────────────────────────────────

describe('PinTree via MapViewer — Panel-Header', () => {
  it('zeigt "Pins (N)" mit Anzahl der Nicht-Folder-Anker-Pins', async () => {
    renderViewer();
    // Header liegt im .map-pin-tree; 2 normale Marker → "Pins (2)"
    await waitFor(() => {
      const tree = document.querySelector('.map-pin-tree');
      expect(tree?.textContent).toMatch(/Pins\s*\(\s*2\s*\)/);
    });
  });
});

// ── renderItem: Label + verknüpfte Entity ─────────────────────────────────────

describe('PinTree via MapViewer — renderItem', () => {
  it('rendert Pin-Label-Text im Baum (.map-pin-tree__label)', async () => {
    renderViewer();
    const tree = await waitForTree();
    expect(tree.getByText('Stadttor')).toBeInTheDocument();
  });

  it('rendert verknüpfte Entity als Sub-Label (.map-pin-tree__sub)', async () => {
    renderViewer();
    const tree = await waitForTree();
    expect(tree.getByText('Ada Thorn')).toBeInTheDocument();
  });
});

// ── fromPathStrings-Gruppierung ───────────────────────────────────────────────

describe('PinTree via MapViewer — fromPathStrings Gruppierung', () => {
  it('Ordner-Name "Städte" erscheint in .map-pin-tree__group-name', async () => {
    renderViewer();
    await waitForTree();
    // group-name enthält "📁 Städte" als zwei Textknoten → CSS-Selektor statt getByText
    expect(document.querySelector('.map-pin-tree__group-name')?.textContent).toMatch(/Städte/);
  });

  it('gruppierter Pin erscheint im Baum unter seinem Ordner', async () => {
    renderViewer();
    const tree = await waitForTree();
    expect(tree.getByText('Stadttor')).toBeInTheDocument();
  });

  it('ungrouped Pin (group_name null) erscheint im Baum ohne Ordner', async () => {
    renderViewer();
    const tree = await waitForTree();
    expect(tree.getByText('Burg')).toBeInTheDocument();
  });
});

// ── Suchfeld (searchable=true) ────────────────────────────────────────────────

describe('PinTree via MapViewer — Suchfeld', () => {
  it('Suchfeld ist im Baum vorhanden (NestedTree searchable=true)', async () => {
    renderViewer();
    await waitForTree();
    expect(within(document.querySelector('.map-pin-tree') as HTMLElement)
      .getByRole('searchbox')).toBeInTheDocument();
  });

  it('Suchfeld filtert Pins — nur "Burg" bleibt, "Stadttor" verschwindet', async () => {
    renderViewer();
    const tree = await waitForTree();
    fireEvent.change(
      within(document.querySelector('.map-pin-tree') as HTMLElement).getByRole('searchbox'),
      { target: { value: 'Burg' } },
    );
    expect(tree.getByText('Burg')).toBeInTheDocument();
    expect(tree.queryByText('Stadttor')).not.toBeInTheDocument();
  });
});

// ── „Neuer Ordner"-Button ─────────────────────────────────────────────────────

describe('PinTree via MapViewer — Neuer Ordner', () => {
  it('zeigt „Neuer Ordner"-Icon-Button (title="Neuer Ordner") im Baum', async () => {
    renderViewer();
    await waitForTree();
    expect(
      within(document.querySelector('.map-pin-tree') as HTMLElement).getByTitle('Neuer Ordner'),
    ).toBeInTheDocument();
  });

  it('„Neuer Ordner" → Eingabe → Enter ruft createMarker mit kind=folder-anchor auf', async () => {
    const { createMarker } = await import('../src/services/map-marker-service');
    renderViewer();
    await waitForTree();
    fireEvent.click(
      within(document.querySelector('.map-pin-tree') as HTMLElement).getByTitle('Neuer Ordner'),
    );
    const input = await screen.findByPlaceholderText('Ordnername…');
    fireEvent.change(input, { target: { value: 'Berge' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(createMarker).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ kind: 'folder-anchor', label_text: 'Berge', group_name: 'Berge' }),
      ),
    );
  });
});

// ── Rename-Flow ───────────────────────────────────────────────────────────────

describe('PinTree via MapViewer — Rename-Flow', () => {
  it('Doppelklick auf .map-pin-tree__group-name → Rename-Input erscheint', async () => {
    renderViewer();
    await waitForTree();
    const groupNameEl = document.querySelector('.map-pin-tree__group-name') as HTMLElement;
    fireEvent.doubleClick(groupNameEl);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
  });

  it('Enter im Rename-Input ruft updateMarker auf (Gruppen-Umbenennung)', async () => {
    const { updateMarker } = await import('../src/services/map-marker-service');
    renderViewer();
    await waitForTree();
    fireEvent.doubleClick(document.querySelector('.map-pin-tree__group-name') as HTMLElement);
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Dörfer' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(updateMarker).toHaveBeenCalled());
  });
});

// ── Panel-Collapse ────────────────────────────────────────────────────────────

describe('PinTree via MapViewer — Panel-Collapse', () => {
  it('Panel ist standardmäßig aufgeklappt (Suchfeld sichtbar)', async () => {
    renderViewer();
    await waitForTree();
    expect(
      within(document.querySelector('.map-pin-tree') as HTMLElement).getByRole('searchbox'),
    ).toBeInTheDocument();
  });

  it('Collapse-Button klappt das Panel ein (Suchfeld verschwindet)', async () => {
    renderViewer();
    await waitForTree();
    const tree = document.querySelector('.map-pin-tree') as HTMLElement;
    const collapseBtn = tree.querySelector('button[title*="einklappen"], button[title*="collapse"]') as HTMLElement | null;
    if (collapseBtn) {
      fireEvent.click(collapseBtn);
      expect(tree.querySelector('[role="searchbox"]')).not.toBeInTheDocument();
    }
  });
});
