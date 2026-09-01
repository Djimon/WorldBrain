// #293 (M14-S06): behavioral test for the calendar day-click path.
//
// The #292 (b) guard test only asserts the EventQuickCreatePanel stub is gone
// (a grep on absence). It does NOT prove the replacement works. This file pins
// the actual behavior end-to-end:
//   day cell click -> title-gate with the FORMATTED calendar date (not the raw
//   counter) -> blank title creates nothing -> non-blank title calls
//   createEventEntity with the clicked start_day -> the editor opens for the
//   newly created entity.
//
// Two layers:
//   A) CalendarMonthView in isolation — the click -> onCreateEvent(counter) seam.
//   B) WorkspaceShell integrated — the real gate/create/editor wiring, with heavy
//      sibling components stubbed so only the calendar path is exercised.
//
// AP-008 (RTL): queries anchored by role / data-attribute / testid, never by
// translated UI text. AP-001: database typed as DatabaseLike, no unknown casts.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n';
import type { DatabaseLike } from '../src/services/entity-service';
import { formatCalendarDate } from '../core_data/calendar-schema';

// ---- shared calendar fixture (matches loadCalendarById's parsed shape) -------

const CAL = {
  id: 'cal-1',
  title: 'Korkh-Time',
  year_length_days: 390,
  months: [{ name: 'Erster Mond', days: 30 }],
  week: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
  epoch_anchor_day: 0,
  start_year: 1,
  start_month: 1,
  start_day: 1,
};

// ---- hoisted mocks (referenced inside vi.mock factories) ---------------------

const h = vi.hoisted(() => ({
  createEventEntity: vi.fn(async () => ({ id: 'new-event' })),
  fakeDb: {
    select: vi.fn(async (sql: string) => (sql.includes('FROM calendars') ? [CAL_ROW_HOISTED()] : [])),
    execute: vi.fn(async () => {}),
  } as unknown as DatabaseLike,
  stub: (name: string) => ({ [name]: () => <div data-testid={`stub-${name}`} /> }),
}));

// CAL_ROW is defined above the hoisted block at runtime, but vi.hoisted runs
// first — read it lazily to avoid a temporal-dead-zone reference.
function CAL_ROW_HOISTED() {
  return {
    id: 'cal-1',
    title: 'Korkh-Time',
    year_length_days: 390,
    months_json: JSON.stringify([{ name: 'Erster Mond', days: 30 }]),
    week_json: JSON.stringify(['Mo', 'Di', 'Mi', 'Do', 'Fr']),
    epoch_anchor_day: 0,
    start_year: 1,
    start_month: 1,
    start_day: 1,
  };
}

vi.mock('../src/services/DatabaseContext', () => ({ useDatabase: () => h.fakeDb }));
vi.mock('../src/services/event-entity-service', () => ({
  createEventEntity: h.createEventEntity,
  listEventEntities: vi.fn(async () => []),
}));
vi.mock('../src/services/era-service', () => ({ listEras: vi.fn(async () => []) }));
vi.mock('../src/services/calendar-service', () => ({
  listCalendars: vi.fn(async () => [{ id: 'cal-1', title: 'Korkh-Time', is_active: 1 }]),
  setActiveCalendar: vi.fn(async () => {}),
  deleteCalendar: vi.fn(async () => {}),
}));
vi.mock('../src/services/map-service', () => ({ listMaps: vi.fn(async () => []), importMapImage: vi.fn() }));
vi.mock('../src/services/saved-views-service', () => ({ listViews: vi.fn(async () => []) }));
vi.mock('../src/services/session-variable-service', () => ({ listVars: vi.fn(async () => []) }));
vi.mock('../src/services/plugin-entity-service', () => ({ listEntityTypes: vi.fn(() => []) }));
vi.mock('../src/services/rule-import-service', () => ({ importRules: vi.fn() }));
vi.mock('../src/services/rule-evaluations', () => ({
  detectMysteryBreakers: vi.fn(), analyzeRoleCoverage: vi.fn(), detectQuestBlockers: vi.fn(),
}));

// EntityDetailView is the editor rendered when calendarEditingEventId is set.
// Stub it so we can assert the editor opened for the created entity id.
vi.mock('../src/ui/EntityDetailView', () => ({
  EntityDetailView: (props: { entityId: string }) => (
    <div data-testid="event-editor" data-entity-id={props.entityId} />
  ),
  clearEntityTabs: vi.fn(),
}));

// Heavy / irrelevant sibling area-components -> trivial stubs so their real
// modules (cytoscape, react-pdf, canvas, ...) never load in jsdom.
vi.mock('../src/ui/MapViewer', () => ({ ...h.stub('MapViewer'), default: () => <div /> }));
vi.mock('../src/ui/GlobalSearch', () => h.stub('GlobalSearch'));
vi.mock('../src/ui/ChronicleView', () => h.stub('ChronicleView'));
vi.mock('../src/ui/CalendarWizard', () => h.stub('CalendarWizard'));
vi.mock('../src/ui/CalendarLinkPanel', () => h.stub('CalendarLinkPanel'));
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

import { CalendarMonthView } from '../src/ui/CalendarMonthView';
import { WorkspaceShell } from '../src/ui/WorkspaceShell';

afterEach(() => {
  vi.clearAllMocks();
});

// ---- A) CalendarMonthView: the click -> onCreateEvent seam -------------------

describe('#293 (A): CalendarMonthView day-cell click reports the clicked day', () => {
  it('clicking a day cell calls onCreateEvent with that cell counter', async () => {
    const onCreateEvent = vi.fn();
    render(
      <CalendarMonthView calendar={CAL} database={h.fakeDb} onCreateEvent={onCreateEvent} onEventClick={vi.fn()} />,
    );
    const cells = await screen.findAllByRole('gridcell');
    expect(cells.length).toBe(30);
    const counter = Number(cells[0].getAttribute('data-day'));
    fireEvent.click(cells[0]);
    expect(onCreateEvent).toHaveBeenCalledTimes(1);
    expect(onCreateEvent).toHaveBeenCalledWith(counter);
  });
});

// ---- B) WorkspaceShell: gate -> create -> editor, blank -> nothing ----------

async function openCalendarWithGridcell() {
  const view = render(
    <WorkspaceShell projectId="p1" projectDir="/proj" snapshotsDir="/snap" onProjectClose={vi.fn()} />,
  );
  const calNav = view.container.querySelector('[data-area="calendar"]') as HTMLElement;
  fireEvent.click(calNav);
  const cells = await screen.findAllByRole('gridcell');
  return { view, cells };
}

describe('#293 (B): WorkspaceShell day-click gate creates an event and opens the editor', () => {
  it('shows the title-gate with the FORMATTED date and creates nothing while the title is blank', async () => {
    const { view, cells } = await openCalendarWithGridcell();
    const counter = Number(cells[0].getAttribute('data-day'));
    fireEvent.click(cells[0]);

    // Gate header shows the formatted calendar date, not the raw counter.
    const gate = await waitFor(() => {
      const el = view.container.querySelector('.cal-inline-event-editor__header');
      if (!el) throw new Error('gate not rendered');
      return el as HTMLElement;
    });
    const expectedDate = formatCalendarDate(CAL, counter);
    expect(gate.textContent).toContain(expectedDate);
    expect(gate.textContent).not.toContain(String(counter));

    // Blank title: the primary confirm is disabled and Enter creates nothing.
    const primary = view.container.querySelector('.cal-inline-event-editor__new-form button.ui-button[data-tone="accent"]') as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.createEventEntity).not.toHaveBeenCalled();
    expect(screen.queryByTestId('event-editor')).not.toBeInTheDocument();
  });

  it('confirming a non-blank title creates the event with the clicked start_day and opens its editor', async () => {
    const { cells } = await openCalendarWithGridcell();
    const counter = Number(cells[0].getAttribute('data-day'));
    fireEvent.click(cells[0]);

    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Belagerung von Karn' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(h.createEventEntity).toHaveBeenCalledTimes(1));
    expect(h.createEventEntity).toHaveBeenCalledWith(
      h.fakeDb,
      { title: 'Belagerung von Karn', start_day: counter, event_kind: 'single' },
    );

    // Editor opens for exactly the created entity.
    const editor = await screen.findByTestId('event-editor');
    expect(editor).toHaveAttribute('data-entity-id', 'new-event');
  });
});
