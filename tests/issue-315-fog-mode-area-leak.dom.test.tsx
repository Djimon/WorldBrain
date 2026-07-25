// bug(p1 maps): Fog-Bemal-Modus endet nicht beim Verlassen des Karten-Bereichs (#315)
// See: https://github.com/Djimon/WorldBrain/issues/315
//
// Root cause: editingFogLayerId/movingLayerId are only reset on map switch
// (WorkspaceShell.tsx ~151: `useEffect(() => { setEditingFogLayerId(null);
// setMovingLayerId(null); }, [selectedMapId]);`). Switching activeArea away
// from 'maps' and back keeps the same selectedMapId, so that effect never
// fires — the fog-paint mode leaks across area switches. There is already an
// analogous activeArea-based reset for the calendar area (~294-295); maps
// has none.
//
// Harness reused from tests/m15-s02-layer-panel-mount.dom.test.tsx (real
// LayerPanel, MapViewer stubbed, heavy siblings stubbed).

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

const h = vi.hoisted(() => ({
  fakeDb: { select: vi.fn(async () => []), execute: vi.fn(async () => {}) } as unknown as DatabaseLike,
  listLayers: vi.fn(async () => [
    {
      id: 'layer-fog-1', map_id: 'map-1', layer_type: 'fog', name: 'Nebel',
      asset_id: null, mask_data: 'data:image/png;base64,AAAA', opacity: 1, z_order: 1, visible: 1,
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

describe('#315: fog-paint mode resets when leaving the maps area', () => {
  it('starting fog-paint mode, leaving "maps" and returning ends the paint mode', async () => {
    const view = await openMapsAndSelectMap();

    const row = await waitFor(() => {
      const el = view.container.querySelector('[data-layer-id="layer-fog-1"]') as HTMLElement | null;
      if (!el) throw new Error('fog layer row not mounted');
      return el;
    });
    fireEvent.click(within(row).getByRole('button', { name: /^details$/i }));
    const fogEditBtn = within(row).getByRole('button', { name: /^bemalen$/i });
    fireEvent.click(fogEditBtn);
    expect(within(row).getByRole('button', { name: /^malen beenden$/i })).toHaveAttribute('aria-pressed', 'true');

    // Leave the maps area (same map stays selected — selectedMapId is unchanged).
    fireEvent.click(view.container.querySelector('[data-area="entities"]') as HTMLElement);
    // Return to maps.
    fireEvent.click(view.container.querySelector('[data-area="maps"]') as HTMLElement);

    const rowAfter = await waitFor(() => {
      const el = view.container.querySelector('[data-layer-id="layer-fog-1"]') as HTMLElement | null;
      if (!el) throw new Error('fog layer row not mounted after returning');
      return el;
    });
    fireEvent.click(within(rowAfter).getByRole('button', { name: /^details$/i }));
    expect(within(rowAfter).getByRole('button', { name: /^bemalen$/i })).toBeInTheDocument();
    expect(within(rowAfter).queryByRole('button', { name: /^malen beenden$/i })).not.toBeInTheDocument();
  });
});
