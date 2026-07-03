import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSessions, createSession, archiveSession } from '../services/session-service';
import type { Session } from '../services/session-service';

interface SessionListProps {
  projectId: string;
  projectDir: string;
  onResumeSession: (sessionId: string) => void;
}

function formatDate(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function formatTime(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

export function SessionList({ projectId, projectDir, onResumeSession }: SessionListProps) {
  const { t } = useTranslation('session');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPlugin, setNewPlugin] = useState('');

  const reload = useCallback(() => {
    listSessions({ projectDir, includeArchived: showArchive })
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [projectDir, showArchive]);

  useEffect(() => { reload(); }, [reload]);

  function handleCreate(): void {
    if (!newTitle.trim()) return;
    createSession({ projectDir, projectId, title: newTitle.trim(), systemPluginId: newPlugin || undefined })
      .then(() => { setNewTitle(''); setNewPlugin(''); setShowNewForm(false); reload(); })
      .catch(() => { /* surfaced via reload */ });
  }

  function handleArchive(sessionId: string): void {
    archiveSession({ projectDir, sessionId }).then(reload).catch(() => { /* noop */ });
  }

  return (
    <div className="session-list">
      <div className="session-list__toolbar">
        <button className="btn btn--primary" onClick={() => setShowNewForm((v) => !v)}>
          {t('sessionList.newSession', 'Neue Session')}
        </button>
        <button className="btn" onClick={() => setShowArchive((v) => !v)}>
          {t('sessionList.showArchive', 'Archiv anzeigen')}
        </button>
      </div>

      {showNewForm && (
        <div className="session-list__form">
          <label>
            {t('sessionList.title', 'Titel')}
            <input
              type="text"
              aria-label={t('sessionList.title', 'Titel')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </label>
          <label>
            {t('sessionList.systemPlugin', 'System-Plugin')}
            <select
              aria-label={t('sessionList.systemPlugin', 'System-Plugin')}
              value={newPlugin}
              onChange={(e) => setNewPlugin(e.target.value)}
            >
              <option value="">{t('sessionList.noPlugin', 'Kein System')}</option>
            </select>
          </label>
          <button className="btn btn--primary" onClick={handleCreate}>
            {t('sessionList.create', 'Erstellen')}
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="session-list__empty">{t('sessionList.empty', 'Keine Sessions vorhanden')}</p>
      ) : (
        <ul className="session-list__items">
          {sessions.map((session) => (
            <li key={session.id} className="session-list__item">
              <span className="session-list__item-title">{session.title}</span>
              <span className="session-list__item-created">{formatDate(session.created_at)}</span>
              <span className="session-list__item-active">{formatTime(session.last_active_at)}</span>
              {session.calendar_position != null && (
                <span className="session-list__item-calendar">{String(session.calendar_position)}</span>
              )}
              {session.system_plugin_id != null && (
                <span className="session-list__item-plugin">{session.system_plugin_id}</span>
              )}
              <button className="btn" onClick={() => onResumeSession(session.id)}>
                {t('sessionList.resume', 'Fortsetzen')}
              </button>
              <button className="btn" onClick={() => handleArchive(session.id)}>
                {t('sessionList.archive', 'Archivieren')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
