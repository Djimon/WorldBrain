// @vitest-environment node
// Token: Status-Chip-Editor mit Icon-Picker — Icon-Set-Registry (#300)
// See: https://github.com/Djimon/WorldBrain/issues/300
//
// Note: pure in-memory registry module (no DatabaseLike consumer) — AP-001
// does not apply here.

import { describe, expect, it } from 'vitest';

async function getRegistry() { return import('../src/services/icon-set-registry'); }

describe('#300 icon-set registry', () => {
  describe('CORE_ICON_SET: fixed default content (V1)', () => {
    it('has exactly the 6 seed icons: poisoned, armour-break, bleeding, asleep, stunned, blinded', async () => {
      const { CORE_ICON_SET } = await getRegistry();
      expect(CORE_ICON_SET.icons.map((i) => i.key).sort()).toEqual(
        ['armour-break', 'asleep', 'bleeding', 'blinded', 'poisoned', 'stunned'],
      );
    });

    it('has id "core"', async () => {
      const { CORE_ICON_SET } = await getRegistry();
      expect(CORE_ICON_SET.id).toBe('core');
    });
  });

  describe('registerIconSet / listIconSets: core first', () => {
    it('registering the core set then a plugin set lists core first', async () => {
      const { registerIconSet, listIconSets, CORE_ICON_SET } = await getRegistry();
      registerIconSet(CORE_ICON_SET);
      registerIconSet({ id: 'dnd_conditions', label: 'D&D Conditions', icons: [{ key: 'prone', glyph: '⬇' }] });
      const sets = listIconSets();
      expect(sets[0]?.id).toBe('core');
    });

    it('re-registering the same set id replaces it', async () => {
      const { registerIconSet, listIconSets } = await getRegistry();
      registerIconSet({ id: 'custom', label: 'Custom v1', icons: [{ key: 'a', glyph: 'A' }] });
      registerIconSet({ id: 'custom', label: 'Custom v2', icons: [{ key: 'b', glyph: 'B' }] });
      const sets = listIconSets();
      const custom = sets.filter((s) => s.id === 'custom');
      expect(custom).toHaveLength(1);
      expect(custom[0]?.label).toBe('Custom v2');
    });
  });

  describe('getIcon: resolves "set_id:icon_key"', () => {
    it('resolves a known reference to its icon definition', async () => {
      const { registerIconSet, getIcon, CORE_ICON_SET } = await getRegistry();
      registerIconSet(CORE_ICON_SET);
      expect(getIcon('core:poisoned')).toMatchObject({ key: 'poisoned' });
    });

    it('returns undefined for an unknown set or key', async () => {
      const { registerIconSet, getIcon, CORE_ICON_SET } = await getRegistry();
      registerIconSet(CORE_ICON_SET);
      expect(getIcon('core:nonexistent')).toBeUndefined();
      expect(getIcon('nonexistent_set:poisoned')).toBeUndefined();
    });
  });

  describe('iconRef helper (IconPicker.tsx)', () => {
    it('formats a "set_id:icon_key" reference', async () => {
      const { iconRef } = await import('../src/ui/IconPicker');
      expect(iconRef('core', { key: 'poisoned' })).toBe('core:poisoned');
    });
  });
});
