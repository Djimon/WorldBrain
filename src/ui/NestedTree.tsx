// refactor(ui) 1/3: NestedTree — stub für Extraktion aus Pin-Baum (#306)
// Drag: onPointerDown → pointermove/elementFromPoint → pointerup (wie PinTree)
// Kein HTML5-drag, kein ↕-Button.
import { useTranslation } from 'react-i18next';

export interface NestedTreeNode {
  id: string;
  label: string;
  path: string;
  children?: NestedTreeNode[];
  itemCount?: number;
}

export type DragPayload =
  | { kind: 'item'; id: string }
  | { kind: 'folder'; path: string };

export interface NestedTreeProps {
  nodes: NestedTreeNode[];
  searchable?: boolean;
  onItemMove?: (itemId: string, targetPath: string) => void;
  onFolderMove?: (oldPath: string, newPath: string) => void;
  onCreateFolder?: (name: string) => void;
  onFolderRename?: (oldPath: string, newName: string) => void;
  renderItem?: (node: NestedTreeNode) => React.ReactNode;
}

export function NestedTree(_props: NestedTreeProps): React.ReactElement {
  useTranslation();
  throw new Error('not implemented');
}

/** Adapter: Pfad-Strings ("a/b/c" in group_name) → NestedTreeNode[] */
export function fromPathStrings(
  _items: Array<{ id: string; path: string; label: string }>,
): NestedTreeNode[] {
  throw new Error('not implemented');
}

/** Adapter: parent_id-Referenzen (map_folders) → NestedTreeNode[] */
export function fromParentId(
  _items: Array<{ id: string; parent_id: string | null; label: string; itemCount?: number }>,
): NestedTreeNode[] {
  throw new Error('not implemented');
}
