// M15-S20 (#310): zentrale, wiederverwendbare Emoji-Picker-Komponente.
// Datenquelle: emojibase-data (reines JSON, offline, kein UI) — D-A.
// UI-Muster: Kategorie-Reiter + Grid, analog IconPicker.tsx (#300) — D-B.
// Suche ist Pflicht (D-C). Strikt frei von Audio-spezifischem Code (D-D) —
// der Aufrufer konsumiert dies nur.
//
// RED-Phase-Stub: Typen/Vertrag stehen fest, Rendering noch nicht
// implementiert.
export interface EmojiPickerProps {
  value: string | null;
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}

export function EmojiPicker(_props: EmojiPickerProps): React.ReactElement {
  throw new Error('not implemented');
}

export default EmojiPicker;
