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
    document.getElementById(groupAnchorId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            onClick={() => scrollToGroup(group.key)}
          >
            {group.message}
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
