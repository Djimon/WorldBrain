// @vitest-environment jsdom
// Regression: im Kalender öffnet ein Klick auf ein Event den Inline-Editor
// (startInEditMode). Wechselt man das angeklickte Event, hält dieselbe gemountete
// EntityDetailView-Instanz kurzzeitig noch das ALTE `result` (load() ist async).
// Der Auto-Edit-Effect darf das Formular NICHT aus dieser veralteten Entity füllen —
// sonst "Klick auf Event B öffnet das Edit von Event A".
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n';
import { EntityDetailView, clearEntityTabs } from '../src/ui/EntityDetailView';

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(async () => []),
  deleteEntity: vi.fn(async () => {}),
  getEffectiveEntity: vi.fn(async ({ entityId }: { entityId: string }) => ({
    found: true,
    entityId,
    entity: {
      id: entityId,
      type: 'Character',
      title: entityId === 'ent-a' ? 'Alpha' : 'Bravo',
      summary: '',
      aliases: [],
      properties: {},
      body: { format: 'portable_blocks_v1', blocks: [] },
      visibility: 'public',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    baseEntity: null,
    overriddenFields: [],
    orphanedOverrideCount: 0,
  })),
}));

afterEach(() => { cleanup(); clearEntityTabs(); });

describe('EntityDetailView: startInEditMode reagiert auf entityId-Wechsel', () => {
  it('lädt beim Wechsel B das Formular von B, nicht das vorherige A', async () => {
    const { rerender } = render(<EntityDetailView entityId="ent-a" startInEditMode />);
    // A öffnet direkt im Edit-Modus mit A's Titel (Header- + Formular-Input).
    await waitFor(() => expect(screen.queryAllByDisplayValue('Alpha').length).toBeGreaterThan(0));

    // Auf B wechseln (wie ein Klick auf ein anderes Kalender-Event).
    rerender(<EntityDetailView entityId="ent-b" startInEditMode />);

    // Formular muss B zeigen — nicht mehr A.
    await waitFor(() => expect(screen.queryAllByDisplayValue('Bravo').length).toBeGreaterThan(0));
    expect(screen.queryAllByDisplayValue('Alpha')).toHaveLength(0);
  });
});
