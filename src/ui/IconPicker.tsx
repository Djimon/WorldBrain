// Token: Status-Chip-Editor — Icon-Picker (Grid-Popover) (#300)
// Reuses icon-set-registry.ts (listIconSets) — a grid popover grouped by set,
// group tabs are jump-anchors only (scroll-to-group; free scrolling works
// too). Each group gets an unobtrusive separator with its label.
import { listIconSets } from '../services/icon-set-registry';
import type { IconSetIcon } from '../services/icon-set-registry';

export interface IconPickerProps {
  value: string | null;
  onSelect: (ref: string) => void;
  onClose?: () => void;
}

export function iconRef(setId: string, icon: IconSetIcon): string {
  return `${setId}:${icon.key}`;
}

function groupAnchorId(setId: string): string {
  return `icon-picker-group-${setId}`;
}

function IconGlyph({ icon }: { icon: IconSetIcon }) {
  if (icon.svg) return <span className="icon-picker__glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon.svg }} />;
  if (icon.src) return <img className="icon-picker__glyph" aria-hidden="true" src={icon.src} alt="" />;
  return <span className="icon-picker__glyph" aria-hidden="true">{icon.glyph}</span>;
}

export function IconPicker({ value, onSelect }: IconPickerProps) {
  const sets = listIconSets();

  function scrollToGroup(setId: string) {
    document.getElementById(groupAnchorId(setId))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="icon-picker">
      <div className="icon-picker__tabs" role="tablist">
        {sets.map((set) => (
          <button
            key={set.id}
            type="button"
            role="tab"
            className="icon-picker__tab"
            onClick={() => scrollToGroup(set.id)}
          >
            {set.label}
          </button>
        ))}
      </div>
      <div className="icon-picker__groups">
        {sets.map((set) => (
          <section key={set.id} className="icon-picker__group" id={groupAnchorId(set.id)}>
            <h3 className="icon-picker__group-label">{set.label}</h3>
            <div className="icon-picker__grid">
              {set.icons.map((icon) => {
                const ref = iconRef(set.id, icon);
                return (
                  <button
                    key={icon.key}
                    type="button"
                    className="icon-picker__icon"
                    aria-label={icon.label ?? icon.key}
                    title={icon.label ?? icon.key}
                    aria-pressed={value === ref}
                    onClick={() => onSelect(ref)}
                  >
                    <IconGlyph icon={icon} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
