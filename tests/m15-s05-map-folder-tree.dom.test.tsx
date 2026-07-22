// M15-S05 / #307: Map-Ordnerbaum konsumiert NestedTree + Umbenennen/Löschen-Regression
// See: https://github.com/Djimon/WorldBrain/issues/277 (original)
//      https://github.com/Djimon/WorldBrain/issues/307 (migration + regression fix)
//
// Drag-Mechanik: data-drop-path + pointer events via NestedTree (wie Pin-Baum).
// elementFromPoint null in jsdom → Drop-Callbacks über elementFromPoint-Mock.
// AP-001: database typed as DatabaseLike.
// AP-003: kein prompt/alert/confirm — via source scan + Dialog-Assertion.
// AP-008 (RTL): anchored queries; within() wo Namen kollidieren könnten.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapFolderTree } from '../src/ui/MapFolderTree';

const FOLDERS = [
  { id: 'mapfolder_dungeons', parent_id: null, name: 'Dungeons', created_at: '' },
  { id: 'mapfolder_level1', parent_id: 'mapfolder_dungeons', name: 'Level 1', created_at: '' },
];

vi.mock('../src/services/map-folder-service', () => ({
  listFolders: vi.fn(async () => FOLDERS),
  createFolder: vi.fn(async () => ({ id: 'mapfolder_new' })),
  renameFolder: vi.fn(async () => undefined),
  deleteFolder: vi.fn(async () => undefined),
  moveMap: vi.fn(async () => undefined),
  moveFolder: vi.fn(async () => undefined),
}));

vi.mock('../src/ui/NestedTree', async (importOriginal) => {
  return importOriginal();
});

const mockDb = { execute: vi.fn(), select: vi.fn() };

const MAPS = [
  { id: 'map-root', title: 'Overworld', folder_id: null },
  { id: 'map-nested', title: 'Cellar', folder_id: 'mapfolder_level1' },
];

describe('M15-S05/#307 map folder tree — NestedTree-Konsument', () => {
  describe('Rendering via NestedTree', () => {
    it('rendert Ordner und Karten', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Overworld')).toBeInTheDocument();
      expect(screen.getByText('Cellar')).toBeInTheDocument();
    });

    it('MapFolderTree enthält keine eigene Collapse/Drag/Suche-Logik (dünner Adapter)', () => {
      const src = readFileSync('src/ui/MapFolderTree.tsx', 'utf-8');
      expect(src).toMatch(/NestedTree/);
      expect(src).not.toMatch(/useState.*collapsed|setCollapsed/);
      expect(src).not.toMatch(/elementFromPoint/);
    });
  });

  describe('Ordner-Header: data-drop-path + cursor:grab (via NestedTree)', () => {
    it('Ordner-Header tragen data-drop-path-Attribut', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      expect(document.querySelector('[data-drop-path="Dungeons"]')).toBeTruthy();
    });

    it('Root-Container hat data-drop-path=""', async () => {
      const { container } = render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      expect(container.querySelector('[data-drop-path=""]')).toBeTruthy();
    });
  });

  describe('Drag: Karte → Ordner ruft moveMap auf', () => {
    it('pointerDown auf Karte + Drop auf Ordner → moveMap(db, mapId, folderId)', async () => {
      const { moveMap } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Overworld')).toBeInTheDocument());

      const dungeonHeader = document.querySelector('[data-drop-path="Dungeons"]') as HTMLElement;
      const overworldEl = screen.getByText('Overworld').closest('[data-item-id]') as HTMLElement
        ?? screen.getByText('Overworld') as HTMLElement;

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(dungeonHeader);
      fireEvent.pointerDown(overworldEl, { clientX: 10, clientY: 10 });
      fireEvent(document, new PointerEvent('pointerup', { clientX: 100, clientY: 100, bubbles: true }));
      vi.restoreAllMocks();

      await waitFor(() => expect(moveMap).toHaveBeenCalledWith(mockDb, 'map-root', expect.any(String)));
    });
  });

  describe('Drag: Ordner → Ordner ruft moveFolder auf', () => {
    it('pointerDown auf Level-1-Header + Drop auf Root → moveFolder(db, id, null)', async () => {
      const { moveFolder } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Level 1')).toBeInTheDocument());

      const level1Header = document.querySelector('[data-drop-path="Level 1"]') as HTMLElement;
      const rootDrop = document.querySelector('[data-drop-path=""]') as HTMLElement;

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(rootDrop);
      fireEvent.pointerDown(level1Header, { clientX: 10, clientY: 10 });
      fireEvent(document, new PointerEvent('pointerup', { clientX: 200, clientY: 200, bubbles: true }));
      vi.restoreAllMocks();

      await waitFor(() => expect(moveFolder).toHaveBeenCalledWith(mockDb, 'mapfolder_level1', null));
    });
  });

  describe('Umbenennen-Regression (#307)', () => {
    it('Doppelklick auf Ordner-Name aktiviert Rename-Input', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      fireEvent.doubleClick(screen.getByText(/dungeons/i));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('Enter im Rename-Input ruft renameFolder auf', async () => {
      const { renameFolder } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      fireEvent.doubleClick(screen.getByText(/dungeons/i));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Crypts' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(renameFolder).toHaveBeenCalledWith(mockDb, 'mapfolder_dungeons', 'Crypts'));
    });
  });

  describe('Löschen-Regression (#307): Dialog, kein confirm(), kein Kaskaden-Löschen', () => {
    it('Löschen-Button zeigt Sicherheitsdialog (kein confirm())', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button', { name: /löschen/i })[0]);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('Bestätigung im Dialog ruft deleteFolder auf', async () => {
      const { deleteFolder } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button', { name: /löschen/i })[0]);
      fireEvent.click(screen.getByRole('button', { name: /bestätigen|ja|löschen/i }));
      await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith(mockDb, 'mapfolder_dungeons'));
    });

    it('MapFolderTree.tsx hat kein ON DELETE CASCADE (kein Kaskaden-Löschen)', () => {
      const src = readFileSync('src/ui/MapFolderTree.tsx', 'utf-8');
      expect(src).not.toMatch(/cascade|deleteMap|delete.*map/i);
    });
  });

  describe('Neuer Ordner', () => {
    it('erstellt Ordner via createFolder', async () => {
      const { createFolder } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /^📁\+$|neuer ordner/i }));
      await waitFor(() => expect(createFolder).toHaveBeenCalled());
    });
  });

  describe('AP-003: kein prompt/alert/confirm', () => {
    it('MapFolderTree.tsx enthält kein prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/MapFolderTree.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
