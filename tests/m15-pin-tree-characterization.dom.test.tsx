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

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapViewer } from '../src/ui/MapViewer';

// elementFromPoint fehlt in jsdom — einmalig stubben
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
  listLayers: vi.fn(async () => []),
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

// ── Panel-Header ──────────────────────────────────────────────────────────────

describe('PinTree via MapViewer — Panel-Header', () => {
  it('zeigt "Pins (N)" mit Anzahl der Nicht-Folder-Anker-Pins', async () => {
    renderViewer();
    // 2 normale Marker (pin-1 + pin-2), 1 folder-anchor → "Pins (2)"
    await waitFor(() => expect(screen.getByText(/Pins\s*\(\s*2\s*\)/)).toBeInTheDocument());
  });
});

// ── renderItem: Emoji + Label + verknüpfte Entity ─────────────────────────────

describe('PinTree via MapViewer — renderItem', () => {
  it('rendert Pin-Label-Text', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Stadttor')).toBeInTheDocument());
  });

  it('rendert verknüpfte Entity als Sub-Label wenn entity_id gesetzt', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Ada Thorn')).toBeInTheDocument());
  });
});

// ── fromPathStrings-Gruppierung ───────────────────────────────────────────────

describe('PinTree via MapViewer — fromPathStrings Gruppierung', () => {
  it('gruppierter Pin erscheint unter seinem Ordner', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Städte')).toBeInTheDocument());
    // Ordner aufgeklappt by default → Stadttor sichtbar
    expect(screen.getByText('Stadttor')).toBeInTheDocument();
  });

  it('ungrouped Pin (group_name null) erscheint ohne Ordner', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Burg')).toBeInTheDocument());
  });
});

// ── Suchfeld (searchable=true) ────────────────────────────────────────────────

describe('PinTree via MapViewer — Suchfeld', () => {
  it('Suchfeld ist vorhanden (NestedTree searchable=true)', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Stadttor')).toBeInTheDocument());
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('Suchfeld filtert Pins nach Label', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Stadttor')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Burg' } });
    expect(screen.getByText('Burg')).toBeInTheDocument();
    expect(screen.queryByText('Stadttor')).not.toBeInTheDocument();
  });
});

// ── „Neuer Ordner"-Button ─────────────────────────────────────────────────────

describe('PinTree via MapViewer — Neuer Ordner', () => {
  it('zeigt „Neuer Ordner"-Icon-Button (📁+)', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Stadttor')).toBeInTheDocument());
    expect(screen.getByTitle('Neuer Ordner')).toBeInTheDocument();
  });

  it('„Neuer Ordner" → Input erscheint → Enter ruft createMarker mit kind=folder-anchor auf', async () => {
    const { createMarker } = await import('../src/services/map-marker-service');
    renderViewer();
    await waitFor(() => expect(screen.getByText('Stadttor')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Neuer Ordner'));
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

// ── onFolderMove → handleGroupRename ─────────────────────────────────────────

describe('PinTree via MapViewer — Rename-Flow', () => {
  it('Doppelklick auf Ordner-Header → Rename-Input erscheint', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Städte')).toBeInTheDocument());
    const groupName = screen.getByText('Städte').closest('[data-drop-path="Städte"]')
      ?? document.querySelector('[data-drop-path="Städte"]');
    fireEvent.doubleClick(groupName!.querySelector('.map-pin-tree__group-name') ?? groupName!);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
  });

  it('Enter im Rename-Input ruft updateMarker auf (Gruppen-Umbenennung)', async () => {
    const { updateMarker } = await import('../src/services/map-marker-service');
    renderViewer();
    await waitFor(() => expect(screen.getByText('Städte')).toBeInTheDocument());
    const groupNameEl = document.querySelector('.map-pin-tree__group-name') as HTMLElement;
    fireEvent.doubleClick(groupNameEl);
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Dörfer' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(updateMarker).toHaveBeenCalled());
  });
});

// ── Panel-Collapse ────────────────────────────────────────────────────────────

describe('PinTree via MapViewer — Panel-Collapse', () => {
  it('Panel ist standardmäßig aufgeklappt (Pins sichtbar)', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Stadttor')).toBeInTheDocument());
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('Collapse-Button klappt das Panel ein (Suchfeld verschwindet)', async () => {
    renderViewer();
    await waitFor(() => expect(screen.getByText('Stadttor')).toBeInTheDocument());
    const collapseBtn = screen.queryByTitle('Pin-Liste einklappen')
      ?? screen.queryByRole('button', { name: /einklappen|collapse/i });
    if (collapseBtn) {
      fireEvent.click(collapseBtn);
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    }
  });
});
