// #294 (P0): LayerPanel (#274 / M15-S02) is built + unit-tested but was mounted
// nowhere -> unreachable. The isolated component test cannot catch that. This
// test pins the MOUNT: the maps area renders the real LayerPanel for a selected
// map (in its container, not in isolation).
//
// Mount decision (#294 option b): LayerPanel docks below the MapViewer in the
// maps main area, visible whenever a map is selected.
//
// AP-008 (RTL): anchored queries (role / class / testid), no translated UI text.
// AP-001: database typed as DatabaseLike, no unknown casts in assertions.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

const h = vi.hoisted(() => ({
  fakeDb: { select: vi.fn(async () => []), execute: vi.fn(async () => {}) } as unknown as DatabaseLike,
  listLayers: vi.fn(async () => [
    {
      id: 'layer-1', map_id: 'map-1', layer_type: 'image', name: 'Grundkarte',
      asset_id: 'asset-1', mask_data: null, opacity: 1, z_order: 0, visible: 1,
      player_visible: 0, created_at: '2026-07-18T00:00:00.000Z',
    },
  ]),
  stub: (name: string) => ({ [name]: () => <div data-testid={`stub-${name}`} /> }),
}));

vi.mock('../src/services/DatabaseContext', () => ({ useDatabase: () => h.fakeDb }));
vi.mock('../src/services/map-service', () => ({
  listMaps: vi.fn(async () => [{ id: 'map-1', title: 'Faerun' }]),
  importMapImage: vi.fn(),
}));
// LayerPanel stays REAL — mock only its data service so it renders a known row.
vi.mock('../src/services/map-layer-service', () => ({
  listLayers: h.listLayers,
  updateLayer: vi.fn(async () => {}),
  deleteLayer: vi.fn(async () => {}),
  reorderLayers: vi.fn(async () => {}),
  LAYER_TYPES: ['image', 'fog', 'token'],
}));
vi.mock('../src/services/calendar-service', () => ({
  listCalendars: vi.fn(async () => []), setActiveCalendar: vi.fn(async () => {}), deleteCalendar: vi.fn(async () => {}),
}));
vi.mock('../src/services/event-entity-service', () => ({ createEventEntity: vi.fn(async () => ({ id: 'x' })), listEventEntities: vi.fn(async () => []) }));
vi.mock('../src/services/era-service', () => ({ listEras: vi.fn(async () => []) }));
vi.mock('../src/services/saved-views-service', () => ({ listViews: vi.fn(async () => []) }));
vi.mock('../src/services/session-variable-service', () => ({ listVars: vi.fn(async () => []) }));
vi.mock('../src/services/plugin-entity-service', () => ({ listEntityTypes: vi.fn(() => []) }));
vi.mock('../src/services/rule-import-service', () => ({ importRules: vi.fn() }));
vi.mock('../src/services/rule-evaluations', () => ({ detectMysteryBreakers: vi.fn(), analyzeRoleCoverage: vi.fn(), detectQuestBlockers: vi.fn() }));

// Heavy / irrelevant siblings -> stubs. MapViewer is stubbed; LayerPanel is NOT.
vi.mock('../src/ui/MapViewer', () => ({ ...h.stub('MapViewer'), default: () => <div /> }));
vi.mock('../src/ui/EntityDetailView', () => ({ EntityDetailView: () => <div data-testid="stub-EntityDetailView" />, clearEntityTabs: vi.fn() }));
vi.mock('../src/ui/GlobalSearch', () => h.stub('GlobalSearch'));
vi.mock('../src/ui/ChronicleView', () => h.stub('ChronicleView'));
vi.mock('../src/ui/CalendarWizard', () => h.stub('CalendarWizard'));
vi.mock('../src/ui/CalendarLinkPanel', () => h.stub('CalendarLinkPanel'));
vi.mock('../src/ui/CalendarMonthView', () => h.stub('CalendarMonthView'));
vi.mock('../src/ui/CardList', () => h.stub('CardList'));
vi.mock('../src/ui/CardCreationFlow', () => h.stub('CardCreationFlow'));
vi.mock('../src/ui/PrintSheetComposer', () => h.stub('PrintSheetComposer'));
vi.mock('../src/ui/PluginManager', () => h.stub('PluginManager'));
vi.mock('../src/ui/DmScreen', () => ({ DmScreen: () => <div />, DmScreenSelector: () => <div /> }));
vi.mock('../src/ui/CaptureInbox', () => h.stub('CaptureInbox'));
vi.mock('../src/ui/EncounterCounters', () => h.stub('EncounterCounters'));
vi.mock('../src/ui/ConditionBuilder', () => ({ ConditionBuilder: () => <div /> }));
vi.mock('../src/ui/PlayerScreen', () => h.stub('PlayerScreen'));
vi.mock('../src/ui/SessionClock', () => h.stub('SessionClock'));
vi.mock('../src/ui/SnapshotManager', () => h.stub('SnapshotManager'));
vi.mock('../src/ui/UpdateNotification', () => h.stub('UpdateNotification'));
vi.mock('../src/ui/EntityMasterDetail', () => h.stub('EntityMasterDetail'));
vi.mock('../src/ui/LanguageSwitcher', () => h.stub('LanguageSwitcher'));
vi.mock('../src/ui/ThemeToggle', () => h.stub('ThemeToggle'));

import { WorkspaceShell } from '../src/ui/WorkspaceShell';

afterEach(() => {
  vi.clearAllMocks();
});

async function openMapsAndSelectMap() {
  const view = render(
    <WorkspaceShell projectId="p1" projectDir="/proj" snapshotsDir="/snap" onProjectClose={vi.fn()} />,
  );
  fireEvent.click(view.container.querySelector('[data-area="maps"]') as HTMLElement);
  const mapBtn = await screen.findByText('Faerun');
  fireEvent.click(mapBtn);
  return view;
}

describe('#294: maps area mounts the LayerPanel for the selected map', () => {
  it('renders the real LayerPanel (not just the isolated component) once a map is selected', async () => {
    const view = await openMapsAndSelectMap();

    // The panel is present in the maps container and loaded layers for the map.
    const panel = await waitFor(() => {
      const el = view.container.querySelector('.layer-panel');
      if (!el) throw new Error('LayerPanel not mounted');
      return el as HTMLElement;
    });
    expect(h.listLayers).toHaveBeenCalledWith(h.fakeDb, 'map-1');

    // Its controls are reachable: the layer row and its opacity slider render.
    expect(view.container.querySelector('.layer-panel__row[aria-label="Grundkarte"]')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
    // Panel sits inside the maps dock, alongside the (stubbed) MapViewer.
    expect(panel.closest('.maps-layer-dock')).toBeInTheDocument();
    expect(screen.getByTestId('stub-MapViewer')).toBeInTheDocument();
  });

  it('does not render the LayerPanel before a map is selected', async () => {
    const view = render(
      <WorkspaceShell projectId="p1" projectDir="/proj" snapshotsDir="/snap" onProjectClose={vi.fn()} />,
    );
    fireEvent.click(view.container.querySelector('[data-area="maps"]') as HTMLElement);
    await screen.findByText('Faerun');
    expect(view.container.querySelector('.layer-panel')).not.toBeInTheDocument();
  });
});
