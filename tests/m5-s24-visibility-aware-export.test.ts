// @vitest-environment node
// M5-S24: Visibility-aware export — resolveVisibility pre-render step for cards/handouts.
// See: https://github.com/Djimon/WorldBrain/issues/90

import { describe, expect, it } from 'vitest';

async function getExportProjection() { return import('../src/services/export-projection'); }

const gmCtx    = { role: 'gm'     as const, knownEntities: [], sessionVars: {}, globalVars: {} };
const playerCtx = { role: 'player' as const, knownEntities: ['char-ada'], sessionVars: {}, globalVars: {} };

const sampleFields = [
  { key: 'name', value: 'Ada Thorn', visibility: 'public' },
  { key: 'secret_motive', value: 'Wants the key', visibility: 'gm_only' },
  { key: 'known_alias', value: 'Red Notary', visibility: 'player_known', entity_id: 'char-ada' },
  { key: 'hidden_fear', value: 'Rats', visibility: 'hidden_until_condition', condition: { '==': [{ var: 'revealed' }, true] } },
];

describe('M5-S24 visibility-aware export', () => {
  describe('exports', () => {
    it('exports projectFieldsForExport function', async () => {
      const mod = await getExportProjection();
      expect(typeof mod.projectFieldsForExport).toBe('function');
    });
  });

  describe('audience: players', () => {
    it('public field included for players', async () => {
      const { projectFieldsForExport } = await getExportProjection();
      const result = projectFieldsForExport(sampleFields, playerCtx);
      expect(result.map((f: { key: string }) => f.key)).toContain('name');
    });

    it('gm_only field omitted for players', async () => {
      const { projectFieldsForExport } = await getExportProjection();
      const result = projectFieldsForExport(sampleFields, playerCtx);
      expect(result.map((f: { key: string }) => f.key)).not.toContain('secret_motive');
    });

    it('player_known field included when entity in knownEntities', async () => {
      const { projectFieldsForExport } = await getExportProjection();
      const result = projectFieldsForExport(sampleFields, playerCtx);
      expect(result.map((f: { key: string }) => f.key)).toContain('known_alias');
    });

    it('hidden_until_condition field omitted when condition false', async () => {
      const { projectFieldsForExport } = await getExportProjection();
      const ctx = { ...playerCtx, sessionVars: { revealed: false } };
      const result = projectFieldsForExport(sampleFields, ctx);
      expect(result.map((f: { key: string }) => f.key)).not.toContain('hidden_fear');
    });

    it('hidden_until_condition field included when condition true', async () => {
      const { projectFieldsForExport } = await getExportProjection();
      const ctx = { ...playerCtx, sessionVars: { revealed: true } };
      const result = projectFieldsForExport(sampleFields, ctx);
      expect(result.map((f: { key: string }) => f.key)).toContain('hidden_fear');
    });
  });

  describe('audience: gm', () => {
    it('GM export includes gm_only fields', async () => {
      const { projectFieldsForExport } = await getExportProjection();
      const result = projectFieldsForExport(sampleFields, gmCtx);
      expect(result.map((f: { key: string }) => f.key)).toContain('secret_motive');
    });

    it('GM sees condition-gated fields regardless', async () => {
      const { projectFieldsForExport } = await getExportProjection();
      const result = projectFieldsForExport(sampleFields, gmCtx);
      expect(result.map((f: { key: string }) => f.key)).toContain('hidden_fear');
    });
  });

  describe('reuse from M4-S05', () => {
    it('source imports resolveVisibility from visibility-service', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/services/export-projection.ts', 'utf8');
      expect(src).toMatch(/resolveVisibility|visibility-service/);
    });
  });
});
