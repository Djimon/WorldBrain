// Token: Status-Chip-Icon-Set-Registry (#300)
// Core + Plugin icon sets, analogous to relation-type-registry /
// plugin-entity-service (registerPlugin*). No fake default plugin — the
// default set is registered by app code as a real "core" set, reachable
// through the same registry API plugins use.
export interface IconSetIcon {
  key: string;
  label?: string;
  /** Exactly one of glyph (icon-font/emoji char) / svg (markup) / src (image URL). */
  glyph?: string;
  svg?: string;
  src?: string;
}

export interface IconSet {
  id: string;
  label: string;
  icons: IconSetIcon[];
}

/**
 * D1 default set content (V1): poisoned, armour-break, bleeding, asleep,
 * stunned, blinded. Pure data — registration itself is a separate stub call,
 * not auto-run at module load (no behavior here, just the fixed set).
 */
export const CORE_ICON_SET: IconSet = {
  id: 'core',
  label: 'Core',
  icons: [
    { key: 'poisoned', label: 'Poisoned', glyph: '☠' },
    { key: 'armour-break', label: 'Armour Break', glyph: '🛡️‍💥' },
    { key: 'bleeding', label: 'Bleeding', glyph: '🩸' },
    { key: 'asleep', label: 'Asleep', glyph: '💤' },
    { key: 'stunned', label: 'Stunned', glyph: '💫' },
    { key: 'blinded', label: 'Blinded', glyph: '👁️‍🗨️' },
  ],
};

/** Registers an icon set (core or plugin). Re-registering the same id replaces it. */
export function registerIconSet(_set: IconSet): void {
  throw new Error('not implemented');
}

/** Lists all registered sets, `core` first. */
export function listIconSets(): IconSet[] {
  throw new Error('not implemented');
}

/** Resolves a "set_id:icon_key" reference to its icon definition, or undefined if unknown. */
export function getIcon(_ref: string): IconSetIcon | undefined {
  throw new Error('not implemented');
}

/** Test/dev helper: clears all registered sets. */
export function clearIconSets(): void {
  throw new Error('not implemented');
}
