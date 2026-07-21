// Token: Status-Chip-Editor — Icon-Picker (Grid-Popover) (#300)
// Reuses icon-set-registry.ts (listIconSets) — a grid popover grouped by set,
// group tabs are jump-anchors only (scroll-to-group; free scrolling works
// too). Each group gets an unobtrusive separator with its label.
import type { IconSetIcon } from '../services/icon-set-registry';

export interface IconPickerProps {
  value: string | null;
  onSelect: (ref: string) => void;
  onClose?: () => void;
}

export function iconRef(setId: string, icon: IconSetIcon): string {
  return `${setId}:${icon.key}`;
}

export function IconPicker(_props: IconPickerProps): never {
  throw new Error('not implemented');
}
