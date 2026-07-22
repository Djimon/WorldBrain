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
 * stunned, blinded. Per the #300 design these are SVG (not emoji): line icons
 * drawn with `currentColor` so the chip color/white-default tints them. Pure
 * data — registration is a separate (stub) call, not auto-run at load.
 */
const SVG = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const CORE_ICON_SET: IconSet = {
  id: 'core',
  label: 'Core',
  icons: [
    { key: 'poisoned', label: 'Poisoned', svg: SVG('<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/><circle cx="9.3" cy="10" r="1.1"/><circle cx="14.7" cy="10" r="1.1"/><path d="M9 20h6"/>') },
    { key: 'armour-break', label: 'Armour Break', svg: SVG('<path d="M12 3 5 5.5V11c0 5 3.4 8 7 10 3.6-2 7-5 7-10V5.5L12 3Z"/><path d="M13 7.5 10 12l3 1-2.5 4"/>') },
    { key: 'bleeding', label: 'Bleeding', svg: SVG('<path d="M12 3s5.5 6.5 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 9.5 12 3 12 3Z"/>') },
    { key: 'asleep', label: 'Asleep', svg: SVG('<path d="M4 8h5l-5 5h5"/><path d="M13 4h4l-4 4h4"/>') },
    { key: 'stunned', label: 'Stunned', svg: SVG('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>') },
    { key: 'blinded', label: 'Blinded', svg: SVG('<path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20 20 4"/>') },
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
