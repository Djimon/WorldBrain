// @vitest-environment jsdom
// #415: real-mount integration. EntityMasterDetail reached through its actual UI in a
// DM-play campaign context must create a campaign-owned entity (campaign_created override,
// NO base_entities write) and show it in the list. In edit mode it still writes the base.
// Real SQLite + real schema.sql (no data-layer mocks).
// See: https://github.com/Djimon/WorldBrain/issues/415

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '../src/i18n';
import type { DatabaseLike } from '../src/services/entity-service';
import { EntityMasterDetail } from '../src/ui/EntityMasterDetail';
import { AppModeContext, type AppModeContextValue } from '../src/ui/AppModeContext';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}
const runtimeSchemaSql = readFileSync('src/data/runtime/schema.sql', 'utf8');
function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}
function count(db: DatabaseSync, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}
function withMode(value: AppModeContextValue, ui: React.ReactElement) {
  return <AppModeContext.Provider value={value}>{ui}</AppModeContext.Provider>;
}

afterEach(() => cleanup());

async function createViaUi(title: string) {
  fireEvent.click(await screen.findByRole('button', { name: /erstellen/i })); // empty-state "Erste(n) … erstellen"
  fireEvent.change(screen.getByRole('textbox'), { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: /^erstellen$/i }));     // the create-form confirm
}

describe('#415 create through the real EntityMasterDetail mount', () => {
  it('DM in a campaign creates a campaign_created override, not a base row', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      render(withMode(
        { mode: 'play', sessionRole: 'dm', activeSessionId: 'camp-1' },
        <EntityMasterDetail initialType="Character" database={asyncDb} />,
      ));
      await createViaUi('Improv NSC');
      await waitFor(() => expect(screen.getByText('Improv NSC')).toBeInTheDocument());
      expect(count(db, 'base_entities')).toBe(0);
      const ov = db.prepare('SELECT campaign_created FROM campaign_entity_overrides').all() as { campaign_created: number }[];
      expect(ov.length).toBe(1);
      expect(ov[0].campaign_created).toBe(1);
    } finally { db.close(); }
  });
});
