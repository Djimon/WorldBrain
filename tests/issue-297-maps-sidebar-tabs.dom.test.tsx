// chore(maps): Layer-Panel als Reiter in der Sidebar (Karten/Ebenen)
// See: https://github.com/Djimon/WorldBrain/issues/297
//
// Note: see MapsSidebarTabs.tsx's header comment — wiring this into
// WorkspaceShell.tsx's maps-area is Implementation Agent scope
// (WorkspaceShell has no render-test harness anywhere in this repo). This
// file covers the actual tab behavior the AC requires, directly.
//
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): anchored queries ("Karten"/"Ebenen" share no prefix, but
// anchored regardless per the blanket AC requirement).

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MapsSidebarTabs } from '../src/ui/MapsSidebarTabs';

function renderTabs(selectedMapId: string | null) {
  return render(
    <MapsSidebarTabs
      selectedMapId={selectedMapId}
      mapsTabContent={<div data-testid="maps-list">Kartenliste</div>}
      layersTabContent={<div data-testid="layer-panel">LayerPanel</div>}
    />,
  );
}

describe('#297 maps sidebar tabs (Karten/Ebenen)', () => {
  describe('no map selected', () => {
    it('the "Karten" tab is active and shows the map list', () => {
      renderTabs(null);
      expect(screen.getByRole('tab', { name: /^karten$/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('maps-list')).toBeInTheDocument();
    });

    it('the "Ebenen" tab is disabled while no map is selected', () => {
      renderTabs(null);
      expect(screen.getByRole('tab', { name: /^ebenen$/i })).toBeDisabled();
    });
  });

  describe('selecting a map auto-switches to "Ebenen"', () => {
    it('rerendering with a selectedMapId switches the active tab to "Ebenen" and shows the LayerPanel', () => {
      const { rerender } = renderTabs(null);
      rerender(
        <MapsSidebarTabs
          selectedMapId="map-1"
          mapsTabContent={<div data-testid="maps-list">Kartenliste</div>}
          layersTabContent={<div data-testid="layer-panel">LayerPanel</div>}
        />,
      );
      expect(screen.getByRole('tab', { name: /^ebenen$/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('layer-panel')).toBeInTheDocument();
    });
  });

  describe('"Karten" switches back manually without clearing the selection', () => {
    it('clicking "Karten" while a map is selected shows the list again', () => {
      renderTabs('map-1');
      fireEvent.click(screen.getByRole('tab', { name: /^karten$/i }));
      expect(screen.getByRole('tab', { name: /^karten$/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('maps-list')).toBeInTheDocument();
    });

    it('the "Ebenen" tab remains enabled (selection still present) after switching back', () => {
      renderTabs('map-1');
      fireEvent.click(screen.getByRole('tab', { name: /^karten$/i }));
      expect(screen.getByRole('tab', { name: /^ebenen$/i })).not.toBeDisabled();
    });

    it('clicking "Ebenen" again shows the LayerPanel', () => {
      renderTabs('map-1');
      fireEvent.click(screen.getByRole('tab', { name: /^karten$/i }));
      fireEvent.click(screen.getByRole('tab', { name: /^ebenen$/i }));
      expect(screen.getByTestId('layer-panel')).toBeInTheDocument();
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('MapsSidebarTabs.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/MapsSidebarTabs.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
