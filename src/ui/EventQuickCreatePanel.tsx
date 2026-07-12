// M14-S06: Tag-Klick → Event-Erstellung mit vorbelegtem Datum (#261)
// Quick-create panel opened from a calendar day-cell click. Title-only +
// event_kind default 'single' (full field set is M14-S07, #262, blocked).
// AP-003: no native prompt/alert/confirm dialogs — rendered React UI only.
import { useState } from 'react';

export interface EventQuickCreatePanelProps {
  day: number;
  onCreate: (params: { title: string; start_day: number; event_kind: 'single' }) => void;
  onCancel: () => void;
}

export function EventQuickCreatePanel({ day, onCreate, onCancel }: EventQuickCreatePanelProps) {
  const [title, setTitle] = useState('');
  const trimmedTitle = title.trim();

  function handleCreate() {
    if (!trimmedTitle) return;
    onCreate({ title: trimmedTitle, start_day: day, event_kind: 'single' });
  }

  return (
    <div role="dialog" aria-label="Event erstellen" className="event-quick-create">
      <span>Tag {day}</span>
      <input
        type="text"
        aria-label="Titel"
        placeholder="Titel"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      />
      <button onClick={handleCreate} disabled={!trimmedTitle}>Erstellen</button>
      <button onClick={onCancel}>Abbrechen</button>
    </div>
  );
}
