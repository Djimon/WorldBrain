// @vitest-environment jsdom
// #418: real-mount check. In a DM-play campaign, RelationsTab shows this campaign's
// campaign-local relations, marks them "Kampagne" and offers a "Promote to world" action.
// Real SQLite + real relations schema. See: https://github.com/Djimon/WorldBrain/issues/418

import { DatabaseSync } from 'node:sqlite';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '../src/i18n';
import type { DatabaseLike } from '../src/services/entity-service';
import { applyRelationsSchema } from '../core_data/relations-schema';
import { addCampaignRelation } from '../src/services/relation-service';
import { RelationsTab } from '../src/ui/RelationsTab';
import { AppModeContext, type AppModeContextValue } from '../src/ui/AppModeContext';

function makeAsyncDb(raw: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); return Promise.resolve(); },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(raw.prepare(sql).all(...(args as never[])) as T[]),
  };
}
function withMode(value: AppModeContextValue, ui: React.ReactElement) {
  return <AppModeContext.Provider value={value}>{ui}</AppModeContext.Provider>;
}
afterEach(() => cleanup());

describe('#418 RelationsTab in a DM-play campaign', () => {
  it('marks a campaign-local relation and offers promote', async () => {
    const raw = new DatabaseSync(':memory:');
    try {
      const db = makeAsyncDb(raw);
      await applyRelationsSchema(db);
      await addCampaignRelation(db, { campaignId: 'camp-1', source_id: 'a', target_id: 'b', relation_type: 'ally_of', visibility: 'public' });

      render(withMode(
        { mode: 'play', sessionRole: 'dm', activeSessionId: 'camp-1' },
        <RelationsTab entityId="a" database={db} />,
      ));

      await waitFor(() => expect(screen.getByText('Kampagne')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'In die Welt übernehmen' })).toBeInTheDocument();
    } finally { raw.close(); }
  });

  it('in edit mode a campaign-local relation is not shown (world only)', async () => {
    const raw = new DatabaseSync(':memory:');
    try {
      const db = makeAsyncDb(raw);
      await applyRelationsSchema(db);
      await addCampaignRelation(db, { campaignId: 'camp-1', source_id: 'a', target_id: 'b', relation_type: 'ally_of', visibility: 'public' });

      render(withMode(
        { mode: 'edit', sessionRole: null, activeSessionId: null },
        <RelationsTab entityId="a" database={db} />,
      ));

      // No campaign badge in edit mode.
      await waitFor(() => expect(screen.getByText(/Keine Relationen|No relations/i)).toBeInTheDocument());
      expect(screen.queryByText('Kampagne')).not.toBeInTheDocument();
    } finally { raw.close(); }
  });
});
