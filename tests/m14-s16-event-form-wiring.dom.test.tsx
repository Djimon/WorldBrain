// bug(P0): Event-Formular nirgends verdrahtet
// See: https://github.com/Djimon/WorldBrain/issues/292
//
// Grundregel (aus dem Issue): nichts neu bauen — EventFormFields (#262),
// EffectEditor (#267), CalendarDateInput (#258) und event-entity-service.ts
// existieren bereits und funktionieren; sie sind nur nirgends gemountet.
// This file pins the wiring gaps directly.
//
// Scope note on point (d) "Datum als echtes Kalenderdatum, nie der Counter":
// projecting start_day/end_day into a real calendar date (via
// CalendarDateInput) requires EntityDetailView to receive the active
// calendar object — a prop EntityDetailView does not have today. Threading
// that through is an architecture decision for the Implementation Agent
// (which calendar is "active" when browsing entities outside the calendar
// area?), not something this test file invents. What IS pinned here: the
// raw counter integer (e.g. 126097) must not leak into the UI as visible
// text — covered by the "no raw property rows for Event" assertions below.
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-008 (RTL): anchored queries.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n';
import { EntityDetailView, clearEntityTabs } from '../src/ui/EntityDetailView';
import { deriveEventKind } from '../src/ui/EventFormFields';

vi.mock('../src/ui/EventFormFields', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ui/EventFormFields')>();
  return {
    ...actual,
    EventFormFields: (props: { eventId: string }) => (
      <div data-testid="event-form-fields-mounted" data-event-id={props.eventId} />
    ),
  };
});

vi.mock('../src/ui/EffectEditor', () => ({
  EffectEditor: (props: { eventId: string }) => (
    <div data-testid="effect-editor-mounted" data-event-id={props.eventId} />
  ),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(async () => []),
  getEffectiveEntity: vi.fn(async ({ entityId }: { entityId: string }) => {
    if (entityId === 'event-1') {
      return {
        found: true,
        entityId: 'event-1',
        entity: {
          id: 'event-1',
          type: 'Event',
          title: 'Siege of Karn',
          summary: '',
          aliases: [],
          properties: { event_kind: 'single', start_day: 126097, category: 'battle' },
          body: { format: 'portable_blocks_v1', blocks: [] },
          visibility: 'public',
          created_at: '2026-06-23T00:00:00.000Z',
          updated_at: '2026-06-23T00:00:00.000Z',
        },
        baseEntity: null,
        overriddenFields: [],
        orphanedOverrideCount: 0,
      };
    }
    return { found: false, entityId, reason: 'base_entity_missing', orphanedOverrideCount: 0 };
  }),
}));

afterEach(() => {
  clearEntityTabs();
});

describe('#292 (a): Entity-Browser mounts EventFormFields for type=Event, not generic PropertiesForm', () => {
  it('edit mode mounts EventFormFields instead of the generic properties form', async () => {
    render(<EntityDetailView entityId="event-1" />);
    await waitFor(() => expect(screen.getByText('Siege of Karn')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^bearbeiten$/i }));
    expect(await screen.findByTestId('event-form-fields-mounted')).toHaveAttribute('data-event-id', 'event-1');
  });

  it('edit mode also mounts EffectEditor for the event', async () => {
    render(<EntityDetailView entityId="event-1" />);
    await waitFor(() => expect(screen.getByText('Siege of Karn')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^bearbeiten$/i }));
    expect(await screen.findByTestId('effect-editor-mounted')).toHaveAttribute('data-event-id', 'event-1');
  });

  it('does not show the generic "Art" property row/control when editing an Event', async () => {
    render(<EntityDetailView entityId="event-1" />);
    await waitFor(() => expect(screen.getByText('Siege of Karn')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^bearbeiten$/i }));
    await screen.findByTestId('event-form-fields-mounted');
    expect(screen.queryByText(/^art$/i)).not.toBeInTheDocument();
  });
});

describe('#292 (d, partial): raw counter integers do not leak into the overview as visible text', () => {
  it('the overview does not show the raw start_day counter (126097) as a property row', async () => {
    render(<EntityDetailView entityId="event-1" />);
    await waitFor(() => expect(screen.getByText('Siege of Karn')).toBeInTheDocument());
    expect(screen.queryByText(/126097/)).not.toBeInTheDocument();
  });

  it('the overview does not show the raw "Starttag" property key for Events', async () => {
    render(<EntityDetailView entityId="event-1" />);
    await waitFor(() => expect(screen.getByText('Siege of Karn')).toBeInTheDocument());
    expect(screen.queryByText(/^starttag$/i)).not.toBeInTheDocument();
  });
});

describe('#292 (b): calendar day-click no longer opens the EventQuickCreatePanel stub', () => {
  it('WorkspaceShell.tsx no longer references the EventQuickCreatePanel stub', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(src).not.toMatch(/EventQuickCreatePanel/);
  });
});

describe('#292 (c): event_kind is derived internally from end_day, never a user-facing "Art" control', () => {
  it('deriveEventKind: no end_day => single', () => {
    expect(deriveEventKind(100, undefined)).toBe('single');
  });

  it('deriveEventKind: end_day === start_day => single', () => {
    expect(deriveEventKind(100, 100)).toBe('single');
  });

  it('deriveEventKind: end_day different from start_day => phase', () => {
    expect(deriveEventKind(100, 105)).toBe('phase');
  });

  // Note: the "no Single/Phase toggle in the DOM" requirement is pinned
  // against the REAL EventFormFields component, not this file (which mocks
  // EventFormFields to test EntityDetailView's mount-wiring in isolation —
  // asserting button-absence through a mock would be a trivial false-pass).
  // That check belongs in EventFormFields.tsx's own test file
  // (m14-s07-event-form-fields.dom.test.tsx), which currently asserts the
  // OPPOSITE (the toggle exists) — a known, intentional conflict: this bug
  // supersedes that part of the old M14-S07 contract. Whoever implements
  // #292 must update m14-s07's "event_kind switcher" tests to match.
});
