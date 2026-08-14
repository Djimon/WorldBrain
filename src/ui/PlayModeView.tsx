import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';

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
          <button data-testid="dm-lobby">{t('playLobby', 'Lobby')}</button>
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
        </div>
      )}
    </div>
  );
}
