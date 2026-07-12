// M14-S06: Tag-Klick → Event-Erstellung mit vorbelegtem Datum (#261)
// Quick-create panel opened from a calendar day-cell click. Title-only +
// event_kind default 'single' (full field set is M14-S07, #262, blocked).
// AP-003: no native prompt/alert/confirm dialogs — rendered React UI only.

export interface EventQuickCreatePanelProps {
  day: number;
  onCreate: (params: { title: string; start_day: number; event_kind: 'single' }) => void;
  onCancel: () => void;
}

export function EventQuickCreatePanel(_props: EventQuickCreatePanelProps): never {
  throw new Error('not implemented');
}
