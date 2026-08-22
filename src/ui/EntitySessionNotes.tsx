import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addLogEntry } from '../services/session-log-service';
import type { DatabaseLike } from '../services/entity-service';
import { Button } from './primitives';

interface Entity {
  id: string;
  name: string;
  type: string;
}

interface EntitySessionNotesProps {
  database: DatabaseLike;
  entity: Entity;
  sessionId: string;
  onApplyToWorld?: (args: { entityId: string; note: string }) => void;
}

export function EntitySessionNotes({ database, entity, sessionId, onApplyToWorld }: EntitySessionNotesProps) {
  const { t } = useTranslation('session');
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

  function logChange(worldChange: boolean): void {
    void addLogEntry(database, {
      session_id: sessionId,
      real_timestamp: new Date().toISOString(),
      world_datetime: '',
      round: null,
      action_type: 'session_note',
      description: note,
      entity_id: entity.id,
      world_change: worldChange,
    });
  }

  function handleNoteBlur(): void {
    if (!note) return;
    logChange(false);
  }

  function handleApplyToWorld(): void {
    logChange(true);
    onApplyToWorld?.({ entityId: entity.id, note });
  }

  return (
    <div className="entity-session-notes">
      <button className="entity-session-notes__toggle" onClick={() => setExpanded((v) => !v)}>
        {t('entityNotes.title', 'Session Notes')}
      </button>

      {expanded && (
        <div className="entity-session-notes__body">
          <label>
            {t('entityNotes.noteLabel', 'Notiz')}
            <textarea
              aria-label={t('entityNotes.noteLabel', 'Notiz')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleNoteBlur}
            />
          </label>
          <Button onClick={handleApplyToWorld}>
            {t('entityNotes.applyToWorld', 'In Welt übernehmen')}
          </Button>
        </div>
      )}
    </div>
  );
}
