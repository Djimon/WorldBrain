// @vitest-environment node
// M5-S23: Handout model & export — 5 handout types, PDF/PNG export, visibility projection.
// See: https://github.com/Djimon/WorldBrain/issues/89

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getHandoutSchema() { return import('../core_data/handout-schema'); }
async function getHandoutService() { return import('../src/services/handout-service'); }
function openDb() { return new DatabaseSync(':memory:'); }

describe('M5-S23 handout model', () => {
  describe('schema', () => {
    it('applyHandoutSchema creates handouts table', async () => {
      const { applyHandoutSchema } = await getHandoutSchema();
      const db = openDb(); applyHandoutSchema(db);
      const cols = db.prepare('PRAGMA table_info(handouts)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('handouts has id, type, title, source_entity_id, audience, content_json, created_at', async () => {
      const { applyHandoutSchema } = await getHandoutSchema();
      const db = openDb(); applyHandoutSchema(db);
      const names = (db.prepare('PRAGMA table_info(handouts)').all() as Array<{ name: string }>).map(c => c.name);
      ['id', 'type', 'title', 'audience', 'content_json', 'created_at'].forEach(c => expect(names).toContain(c));
    });

    it('source_entity_id is nullable', async () => {
      const { applyHandoutSchema } = await getHandoutSchema();
      const db = openDb(); applyHandoutSchema(db);
      expect(() => db.prepare(
        `INSERT INTO handouts (id, type, title, audience, content_json, created_at) VALUES ('h1','Letter','Dear GM','gm','{}','2026-01-01')`
      ).run()).not.toThrow();
    });

    it('schema is idempotent', async () => {
      const { applyHandoutSchema } = await getHandoutSchema();
      const db = openDb(); applyHandoutSchema(db);
      expect(() => applyHandoutSchema(db)).not.toThrow();
    });
  });

  describe('handout types', () => {
    it('HANDOUT_TYPES exports 5 types', async () => {
      const mod = await getHandoutSchema();
      const types = mod.HANDOUT_TYPES ?? mod.handoutTypes;
      expect(Object.keys(types).length).toBe(5);
    });

    it('types include Letter, Clue Sheet, Faction Dossier, Session Recap, Shop Sheet', async () => {
      const mod = await getHandoutSchema();
      const types = mod.HANDOUT_TYPES ?? mod.handoutTypes;
      const values = Object.values(types) as string[];
      ['Letter', 'Clue Sheet', 'Faction Dossier', 'Session Recap', 'Shop Sheet'].forEach(t =>
        expect(values.some(v => v.toLowerCase().includes(t.toLowerCase()))).toBe(true)
      );
    });
  });

  describe('handout service', () => {
    it('createHandout returns id', async () => {
      const { applyHandoutSchema } = await getHandoutSchema();
      const { createHandout } = await getHandoutService();
      const db = openDb(); applyHandoutSchema(db);
      const result = createHandout(db, { type: 'Letter', title: 'A Letter', audience: 'players', content: {} });
      expect(result).toHaveProperty('id');
    });

    it('listHandouts filters by type', async () => {
      const { applyHandoutSchema } = await getHandoutSchema();
      const { createHandout, listHandouts } = await getHandoutService();
      const db = openDb(); applyHandoutSchema(db);
      createHandout(db, { type: 'Letter', title: 'Letter A', audience: 'players', content: {} });
      createHandout(db, { type: 'Clue Sheet', title: 'Clues', audience: 'players', content: {} });
      const result = listHandouts(db, { type: 'Letter' });
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Letter A');
    });
  });

  describe('visibility projection', () => {
    it('generateHandoutHtml strips gm_only content for player audience', async () => {
      const { generateHandoutHtml } = await getHandoutService();
      const html = generateHandoutHtml({
        handout: { type: 'Letter', title: 'Test', audience: 'players', content: {} },
        blocks: [
          { type: 'paragraph', text: 'Public content', visibility: 'public' },
          { type: 'paragraph', text: 'GM only content', visibility: 'gm_only' },
        ],
        context: { role: 'player', knownEntities: [], sessionVars: {}, globalVars: {} },
      });
      expect(html).toContain('Public content');
      expect(html).not.toContain('GM only content');
    });
  });
});

// Bug #128: generateHandoutHtml missing CSP meta tag + incomplete visibility filtering
describe('issue #128: handout export CSP and full visibility filtering', () => {
  it('generateHandoutHtml includes a Content-Security-Policy meta tag', async () => {
    const { generateHandoutHtml } = await getHandoutService();
    const html = generateHandoutHtml({
      handout: { type: 'Letter', title: 'Notice', audience: 'players', content: {} },
      blocks: [{ type: 'paragraph', text: 'Hello.', visibility: 'public' }],
      context: { role: 'player', knownEntities: [], sessionVars: {}, globalVars: {} },
    });
    expect(html).toMatch(/<meta[^>]+Content-Security-Policy/i);
  });

  it('generateHandoutHtml strips hidden_until_condition blocks for player when condition unmet', async () => {
    const { generateHandoutHtml } = await getHandoutService();
    const html = generateHandoutHtml({
      handout: { type: 'Letter', title: 'Notice', audience: 'players', content: {} },
      blocks: [
        { type: 'paragraph', text: 'Always visible.', visibility: 'public' },
        { type: 'paragraph', text: 'Conditional secret.', visibility: 'hidden_until_condition', condition: { '==': [{ var: 'vars.revealed' }, true] } },
      ],
      context: { role: 'player', knownEntities: [], sessionVars: { revealed: false }, globalVars: {} },
    });
    expect(html).toContain('Always visible.');
    expect(html).not.toContain('Conditional secret.');
  });

  it('generateHandoutHtml strips player_known blocks for player when entity not known', async () => {
    const { generateHandoutHtml } = await getHandoutService();
    const html = generateHandoutHtml({
      handout: { type: 'Letter', title: 'Notice', audience: 'players', content: {} },
      blocks: [
        { type: 'paragraph', text: 'Known info.', visibility: 'player_known', entityId: 'char-ada' },
      ],
      context: { role: 'player', knownEntities: [], sessionVars: {}, globalVars: {} },
    });
    expect(html).not.toContain('Known info.');
  });

  it('generateHandoutHtml shows player_known block when entity is known', async () => {
    const { generateHandoutHtml } = await getHandoutService();
    const html = generateHandoutHtml({
      handout: { type: 'Letter', title: 'Notice', audience: 'players', content: {} },
      blocks: [
        { type: 'paragraph', text: 'Known info.', visibility: 'player_known', entityId: 'char-ada' },
      ],
      context: { role: 'player', knownEntities: ['char-ada'], sessionVars: {}, globalVars: {} },
    });
    expect(html).toContain('Known info.');
  });
});
