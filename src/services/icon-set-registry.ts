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
// Slim / minimal line icons (Apple/KISS): thin 1.5 stroke, one clear metaphor
// each, currentColor so the chip color / white default tints them.
const SVG = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const CORE_ICON_SET: IconSet = {
  id: 'core',
  label: 'Core',
  icons: [
    { key: 'poisoned', label: 'Poisoned', svg: SVG('<path d="M12 3a6 6 0 0 0-4 10.4V16h8v-2.6A6 6 0 0 0 12 3Z"/><circle cx="9.6" cy="10" r=".9"/><circle cx="14.4" cy="10" r=".9"/>') },
    { key: 'armour-break', label: 'Armour Break', svg: SVG('<path d="M12 3 6 5.2v5.3c0 4.4 3 7.4 6 8.9 3-1.5 6-4.5 6-8.9V5.2L12 3Z"/><path d="M12.5 7.5 10.5 12h3L11 16"/>') },
    { key: 'bleeding', label: 'Bleeding', svg: SVG('<g transform="translate(12 12) scale(1.1) translate(-12 -12)"><path d="M12 4c3 4 5 6.6 5 9a5 5 0 0 1-10 0c0-2.4 2-5 5-9Z"/></g>') },
    { key: 'asleep', label: 'Asleep', svg: SVG('<path d="M5 17h2.5l-2.5 2.5h2.5"/><path d="M9 11h3.5l-3.5 3.5h3.5"/><path d="M14 4h5l-5 5h5"/>') },
    { key: 'stunned', label: 'Stunned', svg: SVG('<path d="M8 12A4 4 0 0 1 16 12A3.2 3.2 0 0 1 9.6 12A2.4 2.4 0 0 1 14.4 12A1.6 1.6 0 0 1 11.2 12A.8 .8 0 0 1 12.8 12"/>') },
    { key: 'blinded', label: 'Blinded', svg: SVG('<path d="M3.5 12S7 6.5 12 6.5s8.5 5.5 8.5 5.5-3.5 5.5-8.5 5.5S3.5 12 3.5 12Z"/><circle cx="12" cy="12" r="2.2"/><path d="M4 4 20 20"/>') },
    { key: 'prone', label: 'Prone', svg: SVG('<path d="M12 3v9"/><path d="m8 8 4 4 4-4"/><path d="M4 20h16"/>') },
    { key: 'restrained', label: 'Restrained', svg: SVG('<g transform="rotate(-35 12 12)"><rect x="8.5" y="3.5" width="7" height="9" rx="3.5"/><rect x="8.5" y="9.5" width="7" height="9" rx="3.5"/></g>') },
    { key: 'frightened', label: 'Frightened', svg: SVG('<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r=".9"/><circle cx="15" cy="10" r=".9"/><circle cx="12" cy="15.5" r="1.8"/>') },
    { key: 'invisible', label: 'Invisible', svg: SVG('<path d="M6 20V12a6 6 0 0 1 12 0v8l-2.4-1.8-2.4 1.8-2.4-1.8-2.4 1.8Z" stroke-dasharray="2.5 3"/><circle cx="10" cy="11" r="1.1"/><circle cx="14" cy="11" r="1.1"/>') },
    { key: 'on-fire', label: 'On Fire', svg: SVG('<g transform="translate(12 12) scale(1.26) translate(-12 -12)"><path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.8.9-2.6 1.6-3.4.4 1 1.4 1.4 1.4 1.4C11.6 7 11 5 12 3Z"/></g>') },
    { key: 'dead', label: 'Dead', svg: SVG('<path d="M6 21V11a6 6 0 0 1 12 0v10Z"/><path d="M6 21h12"/><path d="M12 6v5m-2.5-2.5h5"/>') },
    { key: 'hasted', label: 'Hasted', svg: SVG('<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>') },
    { key: 'slowed', label: 'Slowed', svg: SVG('<g transform="translate(12 12) scale(0.9) translate(-12 -12)"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2"/></g>') },
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
