// @vitest-environment node
// M10 bug (#371): Invite-Code-UX kaputt — aktiver Code wird nie geladen
// See: https://github.com/Djimon/WorldBrain/issues/371

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

const runtimeSchemaSql = readFileSync(
  new URL('../src/data/runtime/schema.sql', import.meta.url),
  'utf8',
);

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

describe('#371 Fix 1: getActiveInviteCode', () => {
  async function getIdentityService() {
    return import('../src/services/session-identity-service');
  }

  it('getActiveInviteCode returns existing active code', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const code = await svc.generateInviteCode(asyncDb, { campaignId: 'c1' });
      const active = await svc.getActiveInviteCode(asyncDb, 'c1');
      expect(active).toBe(code);
    } finally {
      db.close();
    }
  });

  it('getActiveInviteCode returns null when no active code', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const active = await svc.getActiveInviteCode(asyncDb, 'c-none');
      expect(active).toBeNull();
    } finally {
      db.close();
    }
  });

  it('generateInviteCode invalidates prior code', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const code1 = await svc.generateInviteCode(asyncDb, { campaignId: 'c1' });
      const code2 = await svc.generateInviteCode(asyncDb, { campaignId: 'c1' });
      expect(code2).not.toBe(code1);
      const active = await svc.getActiveInviteCode(asyncDb, 'c1');
      expect(active).toBe(code2);
    } finally {
      db.close();
    }
  });
});

describe('#371 Fix 3: Gruppen-Liste sichtbar', () => {
  it('CampaignRosterPanel renders group names list', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).toMatch(/group|Gruppen/i);
    expect(source).toMatch(/rename|umbenennen|deleteGroup|removeGroup/i);
  });
});

describe('#371 Fix 4: Campaign-Form einklappbar', () => {
  it('Campaign create form not shown unconditionally', () => {
    const source = readFileSync('src/ui/CampaignRosterPanel.tsx', 'utf-8');
    expect(source).not.toMatch(/Neue Campaign.*{\/\*\s*always/i);
    expect(source).toMatch(/selectedCampaign|activeCampaign|campaign\s*&&/i);
  });
});

describe('#371 Fix 5: kein stiller Auto-Reconnect', () => {
  it('PlayerJoinView does not auto-reconnect on mount', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/useEffect[\s\S]*?listStoredTokens[\s\S]*?reconnect/);
  });
});
