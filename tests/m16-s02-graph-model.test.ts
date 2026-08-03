// @vitest-environment node
// M16-S02: Graph-Datenmodell — buildGraphModel (Knoten+degree,
// Relation/Mention-Kanten, Subsumption) (#317)
// See: https://github.com/Djimon/WorldBrain/issues/317
//
// Pure function — no DB access, no rendering, no layout (those come in
// S03/S04/S05). AP-005: ESM import only, no require().

import { describe, expect, it } from 'vitest';
import { buildGraphModel } from '../src/services/graph-model';
import type { GraphEntityInput, GraphLinkInput } from '../src/services/graph-model';

const ENTITIES: GraphEntityInput[] = [
  { id: 'e1', type: 'Character', title: 'Ada' },
  { id: 'e2', type: 'Character', title: 'Bob' },
  { id: 'e3', type: 'Location', title: 'Tavern' },
];

describe('M16-S02 buildGraphModel', () => {
  describe('nodes', () => {
    it('creates one GraphNode per entity with label = title', () => {
      const model = buildGraphModel(ENTITIES, [], []);
      expect(model.nodes).toHaveLength(3);
      expect(model.nodes).toContainEqual({ id: 'e1', type: 'Character', label: 'Ada', degree: 0 });
      expect(model.nodes).toContainEqual({ id: 'e3', type: 'Location', label: 'Tavern', degree: 0 });
    });
  });

  describe('links: kind tagging', () => {
    it('tags relationLinks as kind:"relation"', () => {
      const relationLinks: GraphLinkInput[] = [{ source: 'e1', target: 'e2' }];
      const model = buildGraphModel(ENTITIES, relationLinks, []);
      expect(model.links).toContainEqual({ source: 'e1', target: 'e2', kind: 'relation' });
    });

    it('tags mentionLinks as kind:"mention"', () => {
      const mentionLinks: GraphLinkInput[] = [{ source: 'e1', target: 'e3' }];
      const model = buildGraphModel(ENTITIES, [], mentionLinks);
      expect(model.links).toContainEqual({ source: 'e1', target: 'e3', kind: 'mention' });
    });
  });

  describe('D9 subsumption: relation wins over mention for the same unordered pair', () => {
    it('drops the mention link when a relation link exists for the same pair', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e1', target: 'e2' }],
        [{ source: 'e1', target: 'e2' }],
      );
      const links = model.links.filter((l) =>
        (l.source === 'e1' && l.target === 'e2') || (l.source === 'e2' && l.target === 'e1'));
      expect(links).toHaveLength(1);
      expect(links[0].kind).toBe('relation');
    });

    it('subsumption is unordered: relation(e2,e1) still drops mention(e1,e2)', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e2', target: 'e1' }],
        [{ source: 'e1', target: 'e2' }],
      );
      const mentionLinks = model.links.filter((l) => l.kind === 'mention');
      expect(mentionLinks).toHaveLength(0);
    });

    it('an unrelated mention pair is unaffected by subsumption elsewhere', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e1', target: 'e2' }],
        [{ source: 'e2', target: 'e3' }],
      );
      expect(model.links).toContainEqual({ source: 'e2', target: 'e3', kind: 'mention' });
    });
  });

  describe('dedup: at most one link per (source, target, kind)', () => {
    it('dedupes repeated identical relation links', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e1', target: 'e2' }, { source: 'e1', target: 'e2' }],
        [],
      );
      expect(model.links.filter((l) => l.kind === 'relation')).toHaveLength(1);
    });

    it('dedupes repeated identical mention links', () => {
      const model = buildGraphModel(
        ENTITIES,
        [],
        [{ source: 'e1', target: 'e3' }, { source: 'e1', target: 'e3' }],
      );
      expect(model.links.filter((l) => l.kind === 'mention')).toHaveLength(1);
    });

    it('a relation and a mention with the same endpoints but reversed direction dedupe as one pair (unordered) under subsumption', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e1', target: 'e2' }, { source: 'e2', target: 'e1' }],
        [],
      );
      expect(model.links.filter((l) => l.kind === 'relation')).toHaveLength(1);
    });
  });

  describe('drop: self-links and dangling ids', () => {
    it('drops a self-link (source === target)', () => {
      const model = buildGraphModel(ENTITIES, [{ source: 'e1', target: 'e1' }], []);
      expect(model.links.find((l) => l.source === 'e1' && l.target === 'e1')).toBeUndefined();
    });

    it('drops a link referencing an id not present in entities (dangling)', () => {
      const model = buildGraphModel(ENTITIES, [{ source: 'e1', target: 'e999' }], []);
      expect(model.links.find((l) => l.target === 'e999')).toBeUndefined();
    });

    it('a dangling mention link is also dropped', () => {
      const model = buildGraphModel(ENTITIES, [], [{ source: 'e999', target: 'e1' }]);
      expect(model.links).toHaveLength(0);
    });
  });

  describe('degree: count of remaining incident links, undirected', () => {
    it('a node with no links has degree 0', () => {
      const model = buildGraphModel(ENTITIES, [], []);
      expect(model.nodes.find((n) => n.id === 'e3')?.degree).toBe(0);
    });

    it('degree counts both relation and mention links touching the node', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e1', target: 'e2' }],
        [{ source: 'e1', target: 'e3' }],
      );
      expect(model.nodes.find((n) => n.id === 'e1')?.degree).toBe(2);
      expect(model.nodes.find((n) => n.id === 'e2')?.degree).toBe(1);
      expect(model.nodes.find((n) => n.id === 'e3')?.degree).toBe(1);
    });

    it('degree does not count a link subsumed/dropped by D9 (relation wins)', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e1', target: 'e2' }],
        [{ source: 'e1', target: 'e2' }, { source: 'e1', target: 'e3' }],
      );
      // e1 keeps: relation(e1,e2) + mention(e1,e3) = degree 2, NOT 3
      // (the e1-e2 mention was subsumed, must not double-count).
      expect(model.nodes.find((n) => n.id === 'e1')?.degree).toBe(2);
    });

    it('degree does not double-count a deduped repeated link', () => {
      const model = buildGraphModel(
        ENTITIES,
        [{ source: 'e1', target: 'e2' }, { source: 'e1', target: 'e2' }],
        [],
      );
      expect(model.nodes.find((n) => n.id === 'e1')?.degree).toBe(1);
      expect(model.nodes.find((n) => n.id === 'e2')?.degree).toBe(1);
    });

    it('a self-link never contributes to degree (dropped before counting)', () => {
      const model = buildGraphModel(ENTITIES, [{ source: 'e1', target: 'e1' }], []);
      expect(model.nodes.find((n) => n.id === 'e1')?.degree).toBe(0);
    });
  });

  describe('empty input', () => {
    it('no entities, no links -> empty model', () => {
      const model = buildGraphModel([], [], []);
      expect(model).toEqual({ nodes: [], links: [] });
    });
  });
});
