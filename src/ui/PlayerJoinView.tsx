import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onJoined?: (token: string) => void;
}

type Status = 'idle' | 'error';

export function PlayerJoinView({ onJoined }: Props) {
  const { t } = useTranslation('nav');
  const [serverUrl, setServerUrl] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await invoke<{ token: string }>('player_join_session', {
      serverUrl, code, displayName,
    }).catch(() => null);
    if (!result) {
      setStatus('error');
      return;
    }
    onJoined?.(result.token);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <label>
        {t('playerServerUrl', 'Server-URL/IP-Adresse')}
        <input
          type="text"
          aria-label={t('playerServerUrl', 'Server-URL/IP-Adresse')}
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />
      </label>
      <label>
        {t('playerInviteCode', 'Einladungscode')}
        <input
          type="text"
          aria-label={t('playerInviteCode', 'Einladungscode')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <label>
        {t('playerDisplayName', 'Anzeigename')}
        <input
          type="text"
          aria-label={t('playerDisplayName', 'Anzeigename')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>
      <button type="submit">{t('playerJoin', 'Beitreten')}</button>
      {status === 'error' && (
        <p role="alert">
          {t('playerError', 'Ungültiger Code oder Server nicht erreichbar.')}
        </p>
      )}
    </form>
  );
}
