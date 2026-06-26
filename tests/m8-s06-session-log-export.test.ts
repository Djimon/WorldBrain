// @vitest-environment node
// M8-S06: Session-Log Markdown-Export
// See: https://github.com/Djimon/WorldBrain/issues/158

import { describe, expect, it } from 'vitest';

async function getLogExport() { return import('../src/services/session-log-export-service'); }

const SAMPLE_ENTRIES = [
  {
    id: 'log-1',
    session_id: 's1',
    real_timestamp: '2026-01-10T20:05:00Z',
    world_datetime: 'Jahr 1432, Tag 1, 10:00',
    round: null,
    action_type: 'note',
    description: 'Die Gruppe betritt die Taverne',
    entity_id: null,
  },
  {
    id: 'log-2',
    session_id: 's1',
    real_timestamp: '2026-01-10T21:00:00Z',
    world_datetime: 'Jahr 1432, Tag 1, 14:00',
    round: null,
    action_type: 'combat',
    description: 'Goblin besiegt',
    entity_id: null,
  },
];

describe('M8-S06 session log markdown export', () => {
  describe('exportSessionLogToMarkdown', () => {
    it('returns a non-empty string', async () => {
      const { exportSessionLogToMarkdown } = await getLogExport();
      const md = exportSessionLogToMarkdown({ entries: SAMPLE_ENTRIES });
      expect(typeof md).toBe('string');
      expect(md.length).toBeGreaterThan(0);
    });

    it('output contains descriptions of each entry', async () => {
      const { exportSessionLogToMarkdown } = await getLogExport();
      const md = exportSessionLogToMarkdown({ entries: SAMPLE_ENTRIES });
      expect(md).toContain('Die Gruppe betritt die Taverne');
      expect(md).toContain('Goblin besiegt');
    });

    it('output contains world_datetime of each entry', async () => {
      const { exportSessionLogToMarkdown } = await getLogExport();
      const md = exportSessionLogToMarkdown({ entries: SAMPLE_ENTRIES });
      expect(md).toContain('Jahr 1432');
    });

    it('entries are grouped by world_datetime section (Markdown heading)', async () => {
      const { exportSessionLogToMarkdown } = await getLogExport();
      const md = exportSessionLogToMarkdown({ entries: SAMPLE_ENTRIES });
      expect(md).toMatch(/^#{1,3}\s+Jahr 1432/m);
    });

    it('each entry line contains [world_datetime] and real time', async () => {
      const { exportSessionLogToMarkdown } = await getLogExport();
      const md = exportSessionLogToMarkdown({ entries: SAMPLE_ENTRIES });
      // Format: [Weltzeit] Reale Zeit — Beschreibung
      expect(md).toMatch(/\[.+\]\s+.+—.+/);
    });
  });

  describe('date range filter', () => {
    it('startWorldDatetime filter excludes earlier entries', async () => {
      const { exportSessionLogToMarkdown } = await getLogExport();
      const md = exportSessionLogToMarkdown({
        entries: SAMPLE_ENTRIES,
        startWorldDatetime: 'Jahr 1432, Tag 1, 12:00',
      });
      expect(md).not.toContain('Die Gruppe betritt die Taverne');
      expect(md).toContain('Goblin besiegt');
    });
  });

  describe('HTML escaping', () => {
    it('HTML special characters in description are escaped in output', async () => {
      const { exportSessionLogToMarkdown } = await getLogExport();
      const xssEntry = [{
        id: 'xss-1', session_id: 's1',
        real_timestamp: '2026-01-10T20:00:00Z',
        world_datetime: 'Tag 1',
        round: null, action_type: 'note',
        description: '<script>alert("xss")</script>',
        entity_id: null,
      }];
      const md = exportSessionLogToMarkdown({ entries: xssEntry });
      expect(md).not.toContain('<script>');
    });
  });
});
