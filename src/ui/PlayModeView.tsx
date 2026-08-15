import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { LobbyPanel } from './LobbyPanel';
import { SignalingPanel } from './SignalingPanel';

type Tab = 'map' | 'kampflog' | 'spotlight';

interface Props {
  database: DatabaseLike;
  sessionId: string;
  role: 'dm' | 'player';
  playerId?: string;
}

export function PlayModeView({ database, sessionId, role }: Props) {
  const { t } = useTranslation('nav');
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [sessionTitle, setSessionTitle] = useState<string>(sessionId);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [signalingOpen, setSignalingOpen] = useState(false);

  useEffect(() => {
    database
      .select<{ title: string }>('SELECT title FROM sessions WHERE id = ?', [sessionId])
      .then((rows) => { if (rows[0]) setSessionTitle(rows[0].title); })
      .catch(() => {});
  }, [database, sessionId]);

  return (
    <div>
      {role === 'dm' && (
        <div data-testid="dm-cockpit">
          <span>{sessionTitle}</span>
          <button data-testid="dm-lobby" onClick={() => setLobbyOpen((v) => !v)}>
            {t('playLobby', 'Lobby')}
          </button>
          {lobbyOpen && (
            <LobbyPanel
              database={database}
              sessionId={sessionId}
              onStopHosting={() => setLobbyOpen(false)}
            />
          )}
        </div>
      )}

      <div role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'map'}
          onClick={() => setActiveTab('map')}
        >
          {t('playTabMap', 'Karte')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'kampflog'}
          onClick={() => setActiveTab('kampflog')}
        >
          {t('playTabLog', 'Kampflog')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'spotlight'}
          onClick={() => setActiveTab('spotlight')}
        >
          {t('playTabSpotlight', 'Spotlight')}
        </button>
      </div>

      <div role="tabpanel">
        {activeTab === 'map' && <div>{t('playMapPlaceholder', 'Karte wird geladen…')}</div>}
        {activeTab === 'kampflog' && <div>{t('playLogPlaceholder', 'Kampflog…')}</div>}
        {activeTab === 'spotlight' && <div>{t('playSpotlightPlaceholder', 'Spotlight…')}</div>}
      </div>

      <aside data-testid="free-browse">
        {t('playFreeBrowse', 'Freies Blättern')}
      </aside>

      {role === 'dm' && (
        <div data-testid="dm-authoring">
          {t('playDmAuthoring', 'Welt bearbeiten')}
          <button onClick={() => setSignalingOpen((v) => !v)}>
            {t('playSignalingToggle', 'Internet-Verbindung (Stufe 3)')}
          </button>
          {signalingOpen && <SignalingPanel role="host" />}
        </div>
      )}
    </div>
  );
}
