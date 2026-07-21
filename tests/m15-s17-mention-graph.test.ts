// @vitest-environment node
// M15-S17: Mention-Kanten-Extraktion — @[Name](id) → Graph-Kanten
// See: https://github.com/Djimon/WorldBrain/issues/288

import { describe, expect, it } from 'vitest';
import { buildMentionEdges } from '../src/services/mention-graph';

describe('M15-S17 buildMentionEdges', () => {
  describe('basic edge extraction', () => {
    it('extracts one edge per mention from summary', () => {
      const entities = [
        { id: 'e1', summary: 'Knows @[Ada](e2).', properties_json: null, body_json: null },
        { id: 'e2', summary: null, properties_json: null, body_json: null },
      ];
      const edges = buildMentionEdges(entities);
      expect(edges).toContainEqual({ source: 'e1', target: 'e2' });
    });

    it('extracts edges from string values in properties_json', () => {
      const entities = [
        {
          id: 'e1',
          summary: null,
          properties_json: JSON.stringify({ note: 'See @[Bob](e2) for details.' }),
          body_json: null,
        },
        { id: 'e2', summary: null, properties_json: null, body_json: null },
      ];
      const edges = buildMentionEdges(entities);
      expect(edges).toContainEqual({ source: 'e1', target: 'e2' });
    });
  });

  describe('deduplication', () => {
    it('dedupes repeated mentions of the same target to one edge', () => {
      const entities = [
        {
          id: 'e1',
          summary: '@[Ada](e2) and @[Ada](e2) again.',
          properties_json: null,
          body_json: null,
        },
        { id: 'e2', summary: null, properties_json: null, body_json: null },
      ];
      const edges = buildMentionEdges(entities);
      const e1toe2 = edges.filter((e) => e.source === 'e1' && e.target === 'e2');
      expect(e1toe2).toHaveLength(1);
    });
  });

  describe('drops', () => {
    it('drops self-mentions (source === target)', () => {
      const entities = [
        { id: 'e1', summary: '@[Selbst](e1) referenziert sich.', properties_json: null, body_json: null },
      ];
      const edges = buildMentionEdges(entities);
      expect(edges.find((e) => e.source === 'e1' && e.target === 'e1')).toBeUndefined();
    });

    it('drops dangling mentions (target id not in entity set)', () => {
      const entities = [
        { id: 'e1', summary: '@[Ghost](e999) existiert nicht.', properties_json: null, body_json: null },
      ];
      const edges = buildMentionEdges(entities);
      expect(edges.find((e) => e.target === 'e999')).toBeUndefined();
    });
  });

  describe('malformed JSON', () => {
    it('malformed properties_json yields no edges (no throw)', () => {
      const entities = [
        { id: 'e1', summary: null, properties_json: 'not json', body_json: null },
        { id: 'e2', summary: null, properties_json: null, body_json: null },
      ];
      expect(() => buildMentionEdges(entities)).not.toThrow();
      const edges = buildMentionEdges(entities);
      expect(edges.filter((e) => e.source === 'e1')).toHaveLength(0);
    });

    it('malformed body_json yields no edges (no throw)', () => {
      const entities = [
        { id: 'e1', summary: null, properties_json: null, body_json: '{bad json' },
      ];
      expect(() => buildMentionEdges(entities)).not.toThrow();
    });
  });

  describe('multiple sources', () => {
    it('produces edges from multiple entities independently', () => {
      const entities = [
        { id: 'e1', summary: '@[B](e2)', properties_json: null, body_json: null },
        { id: 'e2', summary: '@[C](e3)', properties_json: null, body_json: null },
        { id: 'e3', summary: null, properties_json: null, body_json: null },
      ];
      const edges = buildMentionEdges(entities);
      expect(edges).toContainEqual({ source: 'e1', target: 'e2' });
      expect(edges).toContainEqual({ source: 'e2', target: 'e3' });
    });
  });
});
