// M15-S20 (#310): zentrale, wiederverwendbare Emoji-Picker-Komponente.
// Datenquelle: emojibase-data (reines JSON, offline, kein UI) — D-A.
// UI-Muster: Kategorie-Reiter + Grid, analog IconPicker.tsx (#300) — D-B.
// Suche ist Pflicht (D-C). Strikt frei von Audio-spezifischem Code (D-D) —
// der Aufrufer konsumiert dies nur.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import emojiData from 'emojibase-data/en/data.json';
import emojiMessages from 'emojibase-data/en/messages.json';
import type { Emoji } from 'emojibase';

export interface EmojiPickerProps {
  value: string | null;
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}

// "component" = skin-tone modifiers, not standalone emoji — excluded, same
// as every other group here is a real, pickable set.
const GROUPS = emojiMessages.groups
  .filter((g) => g.key !== 'component')
  .slice()
  .sort((a, b) => a.order - b.order);

// A handful of entries have no group (uncategorized) — nothing to file them
// under in a grid-by-category picker, so they're excluded.
const ENTRIES: Emoji[] = (emojiData as Emoji[]).filter((e) => e.group !== undefined && e.group !== 2);

// Neutral line-icon per category (same style as icon-set-registry.ts's SVG
// icons: thin stroke, no fill) — tabs show only the icon, the full category
// name is a hover tooltip (title) + the accessible name (aria-label).
const SVG = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const CATEGORY_ICONS: Record<string, string> = {
  'smileys-emotion': SVG('<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".6" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".6" fill="currentColor" stroke="none"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>'),
  'people-body': SVG('<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>'),
  'animals-nature': SVG('<ellipse cx="12" cy="15" rx="4" ry="3.2"/><circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="7" r="1.6"/><circle cx="17" cy="9" r="1.6"/>'),
  'food-drink': SVG('<path d="M5 6h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6Z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2"/>'),
  'travel-places': SVG('<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10Z"/><circle cx="12" cy="11" r="2"/>'),
  activities: SVG('<path d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"/><path d="M9 15h6v3H9z"/><path d="M8 19h8"/><path d="M4 5h3v2a3 3 0 0 1-3 3"/><path d="M20 5h-3v2a3 3 0 0 0 3 3"/>'),
  objects: SVG('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V17h5v-1.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z"/>'),
  symbols: SVG('<path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9Z"/>'),
  flags: SVG('<path d="M6 3v18"/><path d="M6 4h11l-2.5 4L17 12H6"/>'),
};

function groupAnchorId(key: string): string {
  return `emoji-picker-group-${key}`;
}

function matchesQuery(entry: Emoji, query: string): boolean {
  if (entry.label.toLowerCase().includes(query)) return true;
  return (entry.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
}

export function EmojiPicker({ value, onSelect }: EmojiPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ENTRIES.filter((e) => matchesQuery(e, q)) : ENTRIES;
  }, [query]);

  function scrollToGroup(key: string) {
    document.getElementById(groupAnchorId(key))?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  return (
    <div className="emoji-picker">
      <input
        type="search"
        className="emoji-picker__search"
        aria-label={t('emojiPickerSearch', 'Emoji suchen')}
        placeholder={t('emojiPickerSearch', 'Emoji suchen')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="emoji-picker__tabs" role="tablist">
        {GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            role="tab"
            className="emoji-picker__tab"
            aria-label={group.message}
            title={group.message}
            onClick={() => scrollToGroup(group.key)}
          >
            <span
              className="emoji-picker__tab-icon"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: CATEGORY_ICONS[group.key] ?? '' }}
            />
          </button>
        ))}
      </div>
      <div className="emoji-picker__groups">
        {GROUPS.map((group) => {
          const entries = visible.filter((e) => e.group === group.order);
          if (entries.length === 0) return null;
          return (
            <section key={group.key} className="emoji-picker__group" id={groupAnchorId(group.key)}>
              <h3 className="emoji-picker__group-label">{group.message}</h3>
              <div className="emoji-picker__grid">
                {entries.map((entry) => (
                  <button
                    key={entry.hexcode}
                    type="button"
                    className="emoji-picker__emoji"
                    aria-label={entry.label}
                    aria-pressed={value === entry.emoji}
                    onClick={() => onSelect(entry.emoji)}
                  >
                    {entry.emoji}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default EmojiPicker;
