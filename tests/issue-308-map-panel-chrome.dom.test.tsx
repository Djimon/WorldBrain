// @vitest-environment jsdom
// chore(maps) 3/3: Karten-Panel-Chrome an Pin-Panel angleichen (#308)
// See: https://github.com/Djimon/WorldBrain/issues/308
//
// Referenz: Pin-Panel (MapViewer.tsx:334-390)
//   - Kompakte Kopfzeile "Pins (N)" + kleiner Icon-Button "📁+" rechts
//   - Suchfeld direkt darunter
//   - Ganzes Panel einklappbar
// Ziel: Karten-Panel-Chrome identisch — kein Block-Button, kein dominanter Import-Button

import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// MapsSidebarTabs wraps the maps panel chrome — test via the component
// that owns the header + buttons (MapFolderTree header prop or WorkspaceShell fragment)
import { MapFolderTree } from '../src/ui/MapFolderTree';

vi.mock('../src/services/map-folder-service', () => ({
  listFolders: vi.fn(async () => []),
  createFolder: vi.fn(async () => ({ id: 'f1' })),
  renameFolder: vi.fn(async () => undefined),
  deleteFolder: vi.fn(async () => undefined),
  moveMap: vi.fn(async () => undefined),
  moveFolder: vi.fn(async () => undefined),
}));

vi.mock('../src/ui/NestedTree', async (importOriginal) => importOriginal());

const mockDb = { execute: vi.fn(), select: vi.fn() };
const MAPS = [{ id: 'map-1', title: 'Overworld', folder_id: null }];

describe('issue-308 Karten-Panel-Chrome', () => {
  describe('Kopfzeile', () => {
    it('zeigt Karten-Gesamtzahl in der Kopfzeile (wie "Pins (N)")', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      expect(await screen.findByText(/karten\s*\(\s*\d+\s*\)/i)).toBeInTheDocument();
    });

    it('"Neuer Ordner"-Button ist ein kompakter Icon-Button — kein Block-Button', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const btn = await screen.findByRole('button', { name: /📁\+|neuer ordner/i });
      // Block-Buttons haben typischerweise display:block oder width:100%
      expect(btn.style.width).not.toBe('100%');
      expect(btn.closest('.block-button, [class*="block"]')).toBeNull();
    });

    it('"Neuer Ordner"-Button sitzt in der Kopfzeile — nicht darunter als separater Block', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const header = document.querySelector('.map-pin-tree__header, .maps-panel__header, [class*="header"]');
      expect(header).toBeTruthy();
      const btn = await screen.findByRole('button', { name: /📁\+|neuer ordner/i });
      expect(header!.contains(btn)).toBe(true);
    });
  });

  describe('"Karte importieren" tritt visuell zurück', () => {
    it('"Karte importieren"-Button ist kein breiter Block-Button (kein width:100%)', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const importBtn = screen.queryByRole('button', { name: /karte importieren|import/i });
      if (importBtn) {
        expect(importBtn.style.width).not.toBe('100%');
        expect(importBtn.closest('[class*="block"]')).toBeNull();
      }
      // Falls nicht in MapFolderTree sondern in WorkspaceShell: source-check
    });

    it('WorkspaceShell rendert "Karte importieren" nicht als block-level Button', () => {
      const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
      // Muss kein volle-Breite-Block-Button mehr sein
      expect(src).not.toMatch(/karte importieren[\s\S]{0,200}width:\s*['"]?100%/i);
    });
  });

  describe('kein Pin-Panel verändert (Epic D7)', () => {
    it('MapViewer.tsx bleibt unverändert — Pins-Header ist identisch mit Gold-Standard', () => {
      const src = readFileSync('src/ui/MapViewer.tsx', 'utf-8');
      expect(src).toMatch(/Pins\s*\(/);
      expect(src).toMatch(/map-pin-tree__new-folder-btn/);
    });
  });

  describe('i18n + AP-003', () => {
    it('MapFolderTree.tsx nutzt useTranslation (keine hartcodierten Strings)', () => {
      const src = readFileSync('src/ui/MapFolderTree.tsx', 'utf-8');
      expect(src).toMatch(/useTranslation/);
    });

    it('kein confirm/alert/prompt in MapFolderTree.tsx', () => {
      const src = readFileSync('src/ui/MapFolderTree.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
