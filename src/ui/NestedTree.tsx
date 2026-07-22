// chore(ui): Gemeinsame Baum-Komponente für Pin-Baum und Map-Baum (#305)
// Adapter-Schnittstelle: Caller normalisiert Daten in NestedTreeNode[].
// Pin-Baum: path-string "a/b/c" → Adapter baut Hierarchie.
// Map-Baum: parent_id-Referenzen → Adapter baut Hierarchie.
// Komponente selbst kennt weder Pins noch Maps.
import { useTranslation } from 'react-i18next';

export interface NestedTreeNode {
  id: string;
  label: string;
  children?: NestedTreeNode[];
  itemCount?: number;
}

export interface NestedTreeProps {
  nodes: NestedTreeNode[];
  onMove?: (nodeId: string, targetId: string | null) => void;
  renderLeaf?: (node: NestedTreeNode) => React.ReactNode;
  searchable?: boolean;
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

/** Adapter: parent_id-Referenzen → NestedTreeNode[] */
export function fromParentId(
  _items: Array<{ id: string; parent_id: string | null; label: string; itemCount?: number }>,
): NestedTreeNode[] {
  throw new Error('not implemented');
}
