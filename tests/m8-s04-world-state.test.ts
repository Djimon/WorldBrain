// @vitest-environment node
// M8-S04: Cross-Session World State
// See: https://github.com/Djimon/WorldBrain/issues/156

import { describe, expect, it } from 'vitest';

async function getWorldStateService() { return import('../src/services/world-state-service'); }

const SESSION_A = { id: 's-a', calendar_position: 100 };
const SESSION_B = { id: 's-b', calendar_position: 200 };

const WORLD_ENTRY = {
  id: 'we-1',
  world_datetime: 50, // happened at tick 50
  description: 'The dragon was slain',
  world_change: true,
};

describe('M8-S04 cross-session world state', () => {
  describe('chronicle entries visibility', () => {
    it('chronicle entry at world_datetime 50 is visible to session at calendar_position 100', async () => {
      const { isEntryVisibleInSession } = await getWorldStateService();
      const visible = isEntryVisibleInSession({ entry: WORLD_ENTRY, session: SESSION_A });
      expect(visible).toBe(true);
    });

    it('chronicle entry at world_datetime 150 is NOT visible to session at calendar_position 100', async () => {
      const { isEntryVisibleInSession } = await getWorldStateService();
      const futureEntry = { ...WORLD_ENTRY, world_datetime: 150 };
      const visible = isEntryVisibleInSession({ entry: futureEntry, session: SESSION_A });
      expect(visible).toBe(false);
    });

    it('chronicle entry at world_datetime 150 IS visible to session at calendar_position 200', async () => {
      const { isEntryVisibleInSession } = await getWorldStateService();
      const futureEntry = { ...WORLD_ENTRY, world_datetime: 150 };
      const visible = isEntryVisibleInSession({ entry: futureEntry, session: SESSION_B });
      expect(visible).toBe(true);
    });
  });

  describe('entity world changes', () => {
    it('entity change marked world_change:true is visible to sessions past that world time', async () => {
      const { isEntityChangeVisible } = await getWorldStateService();
      const change = { entity_id: 'npc-1', world_datetime: 50, world_change: true, new_status: 'dead' };
      expect(isEntityChangeVisible({ change, session: SESSION_A })).toBe(true);
    });

    it('entity change marked world_change:false is NOT visible across sessions', async () => {
      const { isEntityChangeVisible } = await getWorldStateService();
      const change = { entity_id: 'npc-1', world_datetime: 50, world_change: false, new_status: 'injured' };
      expect(isEntityChangeVisible({ change, session: SESSION_A })).toBe(false);
    });
  });

  describe('unique items', () => {
    it('unique item transfer visible to sessions past that world time', async () => {
      const { isItemChangeVisible } = await getWorldStateService();
      const change = { item_id: 'ring-of-power', unique: true, world_datetime: 50 };
      expect(isItemChangeVisible({ change, session: SESSION_A })).toBe(true);
    });

    it('non-unique item transfer is NOT visible cross-session', async () => {
      const { isItemChangeVisible } = await getWorldStateService();
      const change = { item_id: 'gold-coin', unique: false, world_datetime: 50 };
      expect(isItemChangeVisible({ change, session: SESSION_A })).toBe(false);
    });
  });

  describe('conflict handling', () => {
    it('conflicting world changes are both returned (no auto-resolution)', async () => {
      const { getConflictingWorldChanges } = await getWorldStateService();
      const changes = [
        { entity_id: 'npc-1', world_datetime: 50, world_change: true, new_status: 'dead', session_id: 's-a' },
        { entity_id: 'npc-1', world_datetime: 55, world_change: true, new_status: 'alive', session_id: 's-b' },
      ];
      const conflicts = getConflictingWorldChanges(changes);
      expect(conflicts.length).toBe(2);
    });
  });

  describe('HTML escaping', () => {
    it('world-state-service.ts HTML-escapes user strings before any HTML interpolation', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/world-state-service.ts', 'utf-8'));
      // Either uses escapeHtml helper or does not produce raw HTML at all
      const producesHtml = src.includes('innerHTML') || src.includes('dangerouslySetInner') || src.includes('<html>');
      if (producesHtml) {
        expect(src).toMatch(/escapeHtml|escape.*html|sanitize/i);
      } else {
        expect(true).toBe(true); // no HTML output → no escaping needed
      }
    });
  });
});
