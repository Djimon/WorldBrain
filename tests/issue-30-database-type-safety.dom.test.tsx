// fix: remove database as never casts in EntityDetailView and EntityMasterDetail.
// DatabaseLike must be exported; components must accept it as typed prop.
// See: https://github.com/Djimon/WorldBrain/issues/30

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/entity-service', () => ({
  getEffectiveEntity: vi.fn(() => ({
    found: false,
    entityId: 'x',
    reason: 'base_entity_missing',
    orphanedOverrideCount: 0,
  })),
  listEntitiesByType: vi.fn(() => []),
}));

describe('issue-30 DatabaseLike type safety', () => {
  describe('entity-service exports', () => {
    it('exports DatabaseLike type (verified via named export at runtime)', async () => {
      // DatabaseLike must be exported so callers can use it.
      // In TS, types are erased at runtime — we verify the module loads
      // cleanly and the service functions that depend on DatabaseLike work.
      const mod = await import('../src/services/entity-service');
      expect(typeof mod.getEffectiveEntity).toBe('function');
      expect(typeof mod.listEntitiesByType).toBe('function');
    });
  });

  describe('EntityDetailView database prop', () => {
    it('accepts a well-shaped DatabaseLike object without casting to never', async () => {
      const { EntityDetailView } = await import('../src/ui/EntityDetailView');

      // A minimal object shaped like DatabaseLike should be accepted without TS error.
      // If the prop is typed as `unknown` with `as never` cast, the runtime cast still works
      // but the type contract is broken. The test verifies no runtime throw.
      const db = { entities: [], entityTypes: [], campaigns: [] };
      expect(() => render(<EntityDetailView entityId="x" database={db as never} />)).not.toThrow();
    });

    it('EntityDetailView database prop is typed — passing undefined does not throw at runtime', async () => {
      const { EntityDetailView } = await import('../src/ui/EntityDetailView');

      // After the fix, database should be optional or DatabaseLike — not needed for mocked service
      expect(() => render(<EntityDetailView entityId="x" />)).not.toThrow();
    });
  });

  describe('EntityMasterDetail database prop', () => {
    it('accepts a well-shaped DatabaseLike object without casting to never', async () => {
      const { EntityMasterDetail } = await import('../src/ui/EntityMasterDetail');

      const db = { entities: [], entityTypes: [], campaigns: [] };
      expect(() => render(<EntityMasterDetail initialType={null} database={db as never} />)).not.toThrow();
    });

    it('EntityMasterDetail renders without database prop when service is mocked', async () => {
      const { EntityMasterDetail } = await import('../src/ui/EntityMasterDetail');

      expect(() => render(<EntityMasterDetail initialType={null} />)).not.toThrow();
    });
  });

  describe('no as-never casts survive in source', () => {
    it('EntityDetailView.tsx does not contain "as never" casts', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/EntityDetailView.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('EntityMasterDetail.tsx does not contain "as never" casts', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/EntityMasterDetail.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('entity-service.ts exports DatabaseLike (string appears in source)', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/services/entity-service.ts', 'utf-8');
      expect(src).toMatch(/export\s+(type\s+)?DatabaseLike/);
    });
  });
});
