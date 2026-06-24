// @vitest-environment node
// M4-S08: Player view export — static HTML bundle filtered to player-visible content.
// See: https://github.com/Djimon/WorldBrain/issues/56

import { describe, expect, it } from 'vitest';

async function getExportService() {
  return import('../src/services/player-view-export');
}

const gmContext = { audience: 'gm' as const, vars: {}, globals: {}, flags: {}, knownEntities: new Set<string>() };
const playerContext = { audience: 'player' as const, vars: {}, globals: {}, flags: {}, knownEntities: new Set(['char-ada']) };

const entities = [
  {
    id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: 'Archivist.',
    visibility: 'public' as const,
    body: { format: 'portable_blocks_v1' as const, blocks: [
      { type: 'paragraph' as const, text: 'She keeps records.' },
      { type: 'paragraph' as const, text: 'Secret: She is a double agent.', visibility: 'gm_only' as const },
    ]},
    aliases: [], properties: {}, created_at: '', updated_at: '',
  },
  {
    id: 'char-bram', type: 'Character', title: 'Bram Holt', summary: 'Innkeeper.',
    visibility: 'gm_only' as const,
    body: { format: 'portable_blocks_v1' as const, blocks: [] },
    aliases: [], properties: {}, created_at: '', updated_at: '',
  },
];

describe('M4-S08 player view export', () => {
  describe('generatePlayerViewHtml export', () => {
    it('exports generatePlayerViewHtml function', async () => {
      const mod = await getExportService();
      expect(typeof mod.generatePlayerViewHtml).toBe('function');
    });

    it('returns a string', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: playerContext, selectedEntityIds: ['char-ada'] });
      expect(typeof html).toBe('string');
    });

    it('returns valid HTML with a DOCTYPE or html tag', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: playerContext, selectedEntityIds: ['char-ada'] });
      expect(html).toMatch(/<!DOCTYPE|<html/i);
    });
  });

  describe('content filtering', () => {
    it('includes public entity content in the export', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: playerContext, selectedEntityIds: ['char-ada'] });
      expect(html).toContain('Ada Thorn');
    });

    it('excludes gm_only entities from player export', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: playerContext, selectedEntityIds: ['char-ada', 'char-bram'] });
      expect(html).not.toContain('Bram Holt');
    });

    it('excludes gm_only blocks within a public entity', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: playerContext, selectedEntityIds: ['char-ada'] });
      expect(html).not.toContain('double agent');
    });

    it('includes public block content', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: playerContext, selectedEntityIds: ['char-ada'] });
      expect(html).toContain('She keeps records.');
    });
  });

  describe('self-contained output', () => {
    it('output does not reference external stylesheets or scripts by URL', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: playerContext, selectedEntityIds: ['char-ada'] });
      // No <link rel="stylesheet" href="http..."> or <script src="http...">
      expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\//i);
      expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
    });
  });

  describe('audience field', () => {
    it('GM export shows gm_only content', async () => {
      const { generatePlayerViewHtml } = await getExportService();
      const html = generatePlayerViewHtml({ entities, context: gmContext, selectedEntityIds: ['char-ada', 'char-bram'] });
      expect(html).toContain('Bram Holt');
    });
  });
});

// Bug #113 — XSS: entity titles and block text must be HTML-escaped in export (AP-004, Security)
describe('issue #113: XSS escaping in player view export', () => {
  const xssEntities = [
    {
      id: 'char-xss', type: 'Character',
      title: '</h2><script>alert(1)</script><h2>',
      summary: 'XSS title.',
      visibility: 'public' as const,
      body: { format: 'portable_blocks_v1' as const, blocks: [
        { type: 'paragraph' as const, text: '<img src=x onerror=alert(2)>' },
      ]},
      aliases: [], properties: {}, created_at: '', updated_at: '',
    },
  ];

  const ctx = { audience: 'player' as const, vars: {}, globals: {}, flags: {}, knownEntities: new Set(['char-xss']) };

  it('escapes < and > in entity title', async () => {
    const { generatePlayerViewHtml } = await getExportService();
    const html = generatePlayerViewHtml({ entities: xssEntities, context: ctx, selectedEntityIds: ['char-xss'] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;');
  });

  it('escapes < and > in block text', async () => {
    const { generatePlayerViewHtml } = await getExportService();
    const html = generatePlayerViewHtml({ entities: xssEntities, context: ctx, selectedEntityIds: ['char-xss'] });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('includes a Content-Security-Policy meta tag in the exported HTML head', async () => {
    const { generatePlayerViewHtml } = await getExportService();
    const html = generatePlayerViewHtml({ entities: xssEntities, context: ctx, selectedEntityIds: ['char-xss'] });
    expect(html).toMatch(/<meta[^>]+Content-Security-Policy/i);
  });

  it('does not produce a raw </h2><script> sequence in the output', async () => {
    const { generatePlayerViewHtml } = await getExportService();
    const html = generatePlayerViewHtml({ entities: xssEntities, context: ctx, selectedEntityIds: ['char-xss'] });
    expect(html).not.toMatch(/<\/h[1-6]><script/i);
  });
});
