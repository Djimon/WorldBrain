// @vitest-environment jsdom
// chore(maps) 3/3: Karten-Panel-Chrome an Pin-Panel angleichen (#308)
// See: https://github.com/Djimon/WorldBrain/issues/308
//
// Referenz (Gold-Standard, Epic D7): Pin-Panel via MapViewer.tsx -> NestedTree.tsx
//   - Root-Container .map-pin-tree, Kopfzeile .map-pin-editor__header
//   - Kopfzeile enthält Titel+Zähler und einen kompakten Icon-Button
//     (Klasse map-pin-tree__new-folder-btn, Emoji-Label, kein Text-Button)
//   - Suchfeld direkt darunter, ganzes Panel einklappbar (via Sidebar)
//
// MapFolderTree konsumiert NestedTree (s. m15-s05) und reicht den
// "Karte importieren"-Button über die header-Prop rein. Diese Tests prüfen
// strukturell (nicht per String-Regex), dass dieser Button dieselbe
// Icon-Button-Klasse trägt wie der eingebaute "Neuer Ordner"-Button und im
// selben Header-Container sitzt — statt nur zu behaupten "ist kein Block".

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapFolderTree } from '../src/ui/MapFolderTree';

vi.mock('../src/services/map-folder-service', () => ({
  listFolders: vi.fn(async () => []),
  createFolder: vi.fn(async () => ({ id: 'f1' })),
  renameFolder: vi.fn(async () => undefined),
  deleteFolder: vi.fn(async () => undefined),
  moveMap: vi.fn(async () => undefined),
  moveFolder: vi.fn(async () => undefined),
}));

const mockDb = { execute: vi.fn(), select: vi.fn() };
const MAPS = [{ id: 'map-1', title: 'Overworld', folder_id: null }];

function headerEl() {
  return document.querySelector('.map-pin-editor__header') as HTMLElement;
}

describe('issue-308 Karten-Panel-Chrome', () => {
  describe('Root-Container identisch zum Pin-Panel', () => {
    it('rendert denselben Root-Container wie das Pin-Panel (.map-pin-tree)', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(document.querySelector('.map-pin-tree')).toBeTruthy());
    });

    it('Kopfzeile ist .map-pin-editor__header (identisch zum Pin-Panel-Markup)', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(headerEl()).toBeTruthy());
    });
  });

  describe('Kopfzeile: Zähler + Buttons', () => {
    it('zeigt "Karten (N)" in der Kopfzeile', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      await waitFor(() => expect(headerEl().textContent).toMatch(/Karten\s*\(\s*1\s*\)/));
    });

    it('"Neuer Ordner"-Button (📁+) sitzt in der Kopfzeile, nicht separat darunter', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const btn = await screen.findByTitle('Neuer Ordner');
      expect(headerEl().contains(btn)).toBe(true);
    });

    it('"Neuer Ordner"-Button ist reiner Icon-Button ohne sichtbaren Fließtext', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      const btn = await screen.findByTitle('Neuer Ordner');
      expect(btn.textContent).toBe('📁+');
    });
  });

  describe('"Karte importieren" teilt Icon-Button-Chrome mit "Neuer Ordner" (Gold-Standard-Adaption)', () => {
    it('rendert Import-Button nur wenn onImportMap übergeben wird', () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} />);
      expect(screen.queryByTitle('Karte importieren')).toBeNull();
    });

    it('Import-Button trägt dieselbe CSS-Klasse wie der Neuer-Ordner-Button (map-pin-tree__new-folder-btn)', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} onImportMap={vi.fn()} />);
      const importBtn = await screen.findByTitle('Karte importieren');
      const newFolderBtn = await screen.findByTitle('Neuer Ordner');
      expect(importBtn.className).toBe(newFolderBtn.className);
    });

    it('Import-Button sitzt in derselben Kopfzeile wie Titel und Neuer-Ordner-Button', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} onImportMap={vi.fn()} />);
      const importBtn = await screen.findByTitle('Karte importieren');
      expect(headerEl().contains(importBtn)).toBe(true);
    });

    it('Import-Button ist reiner Icon-Button (Emoji, kein Textlabel)', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} onImportMap={vi.fn()} />);
      const importBtn = await screen.findByTitle('Karte importieren');
      expect(importBtn.textContent).toBe('🗺️+');
    });

    it('Klick auf Import-Button ruft onImportMap auf', async () => {
      const onImportMap = vi.fn();
      render(<MapFolderTree database={mockDb} maps={MAPS} onImportMap={onImportMap} />);
      fireEvent.click(await screen.findByTitle('Karte importieren'));
      expect(onImportMap).toHaveBeenCalledTimes(1);
    });

    it('importing=true zeigt ⏳ und deaktiviert den Button', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} onImportMap={vi.fn()} importing />);
      const importBtn = await screen.findByTitle('Importiere…');
      expect(importBtn.textContent).toBe('⏳');
      expect(importBtn).toBeDisabled();
    });
  });

  describe('kein Block-Button irgendwo im Panel', () => {
    it('keine gerenderten Buttons haben width:100% oder eine block-Klasse', async () => {
      render(<MapFolderTree database={mockDb} maps={MAPS} onImportMap={vi.fn()} />);
      await waitFor(() => expect(headerEl()).toBeTruthy());
      const buttons = Array.from(document.querySelectorAll('button'));
      expect(buttons.length).toBeGreaterThan(0);
      for (const btn of buttons) {
        expect(btn.style.width).not.toBe('100%');
        expect(btn.className).not.toMatch(/block/i);
      }
    });
  });

  describe('kein Pin-Panel verändert (Epic D7 Regressionsschutz)', () => {
    it('NestedTree.tsx (gemeinsame Basis) trägt weiterhin die Gold-Standard-Klassen', () => {
      const src = readFileSync('src/ui/NestedTree.tsx', 'utf-8');
      expect(src).toMatch(/map-pin-tree__new-folder-btn/);
      expect(src).toMatch(/map-pin-editor__header/);
    });

    it('MapViewer.tsx nutzt weiterhin den "Pins (N)"-Panel-Titel (jetzt via i18n-Key pinTree.header)', () => {
      const src = readFileSync('src/ui/MapViewer.tsx', 'utf-8');
      // Titel wurde lokalisiert: Literal "Pins (" lebt jetzt im Locale, die
      // MapViewer-Verdrahtung referenziert den Key pinTree.header.
      expect(src).toMatch(/pinTree\.header/);
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
