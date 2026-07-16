// M15-S05: Map-Ordnerbaum — verschachtelte Folders für Maps (UI)
// See: https://github.com/Djimon/WorldBrain/issues/277
//
// Note: see MapFolderTree.tsx's header comment — "move to folder" is tested
// via an accessible select per row, not PinTree's document.elementFromPoint
// drag pattern (unavailable/no precedent in jsdom).
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): anchored queries; getAllBy*/within where folder/map names
// could collide.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const mockDb = { execute: vi.fn(), select: vi.fn() };

const MAPS = [
  { id: 'map-root', title: 'Overworld', folder_id: null },
  { id: 'map-nested', title: 'Cellar', folder_id: 'mapfolder_level1' },
];

describe('M15-S05 map folder tree', () => {
  describe('nested rendering: folders (arbitrary depth) + ungrouped maps at root', () => {
    it('renders both folders and both maps', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Overworld')).toBeInTheDocument();
      expect(screen.getByText('Cellar')).toBeInTheDocument();
    });
  });

  describe('new-folder control', () => {
    it('creates a folder via createFolder', async () => {
      const { createFolder } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /^neuer ordner$/i }));
      await waitFor(() => expect(createFolder).toHaveBeenCalled());
    });
  });

  describe('inline rename control', () => {
    it('renaming "Dungeons" calls renameFolder', async () => {
      const { renameFolder } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const folderRow = await screen.findByRole('listitem', { name: /^dungeons/i });
      fireEvent.click(within(folderRow).getByRole('button', { name: /^umbenennen$/i }));
      const input = within(folderRow).getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Crypts' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(renameFolder).toHaveBeenCalledWith(mockDb, 'mapfolder_dungeons', 'Crypts'));
    });
  });

  describe('moving a map into a folder', () => {
    it('selecting a folder for "Overworld" calls moveMap', async () => {
      const { moveMap } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const mapRow = await screen.findByRole('listitem', { name: /^overworld/i });
      const select = within(mapRow).getByRole('combobox', { name: /^verschieben nach$/i });
      fireEvent.change(select, { target: { value: 'mapfolder_dungeons' } });
      await waitFor(() => expect(moveMap).toHaveBeenCalledWith(mockDb, 'map-root', 'mapfolder_dungeons'));
    });
  });

  describe('reparenting a folder', () => {
    it('moving "Level 1" to root calls moveFolder with null', async () => {
      const { moveFolder } = await import('../src/services/map-folder-service');
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const folderRow = await screen.findByRole('listitem', { name: /^level 1/i });
      const select = within(folderRow).getByRole('combobox', { name: /^ordner verschieben nach$/i });
      fireEvent.change(select, { target: { value: '' } });
      await waitFor(() => expect(moveFolder).toHaveBeenCalledWith(mockDb, 'mapfolder_level1', null));
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('MapFolderTree.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/MapFolderTree.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
