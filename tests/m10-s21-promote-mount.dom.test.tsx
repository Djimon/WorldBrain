// @vitest-environment jsdom
// M10-S21 (#365): DOM-Test über den ECHTEN Mount — der Promote-Schalter
// erscheint genau dann, wenn EntityDetailView im aktiven DM-Play-Campaign-
// Kontext (useAppMode) steht, und NICHT im Autoren-/Edit-Modus.
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityDetailView } from '../src/ui/EntityDetailView';
import { AppModeContext, type AppModeContextValue } from '../src/ui/AppModeContext';

// Entity-Daten kommen über den (gemockten) Service, nicht über eine Live-DB.
vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(async () => []),
  getEffectiveEntity: vi.fn(async ({ entityId }: { entityId: string }) => ({
    found: true,
    entityId,
    entity: {
      id: entityId, type: 'Character', title: 'Ada', summary: '', aliases: [],
      properties: { hp: 10 }, body: { format: 'portable_blocks_v1', blocks: [] },
      visibility: 'public', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
    baseEntity: null, overriddenFields: [], orphanedOverrideCount: 0,
  })),
  deleteEntity: vi.fn(async () => {}),
}));

// isPromoted (in PromoteControl) fragt database.select → [] = nicht promoted.
const database = {
  select: vi.fn(async () => [] as unknown[]),
  execute: vi.fn(async () => {}),
} as unknown as Parameters<typeof EntityDetailView>[0]['database'];

function withMode(value: AppModeContextValue, ui: React.ReactElement) {
  return <AppModeContext.Provider value={value}>{ui}</AppModeContext.Provider>;
}

afterEach(() => cleanup());

describe('M10-S21 Promote-Schalter via echten Mount', () => {
  it('renders the promote control in DM-play-campaign context', async () => {
    render(withMode(
      { mode: 'play', sessionRole: 'dm', activeSessionId: 'camp-1' },
      <EntityDetailView entityId="ent-1" database={database} />,
    ));
    // Promote-Schalter (role=group, aria-label "In die Welt übernehmen").
    await waitFor(() => {
      expect(screen.getByRole('group', { name: /In die Welt übernehmen/i })).toBeInTheDocument();
    });
    // Konkret der Promote-Button (nicht-promoted → Aktion sichtbar).
    expect(screen.getByRole('button', { name: /^In die Welt übernehmen$/i })).toBeInTheDocument();
  });

  it('does NOT render the promote control in author/edit mode (no campaign)', async () => {
    render(withMode(
      { mode: 'edit', sessionRole: null, activeSessionId: null },
      <EntityDetailView entityId="ent-1" database={database} />,
    ));
    // Warten bis die Entity geladen ist (Titel erscheint), dann Abwesenheit prüfen.
    await waitFor(() => expect(screen.getByText('Ada')).toBeInTheDocument());
    expect(screen.queryByRole('group', { name: /In die Welt übernehmen/i })).not.toBeInTheDocument();
  });
});
